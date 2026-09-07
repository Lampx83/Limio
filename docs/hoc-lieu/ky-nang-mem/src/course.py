# -*- coding: utf-8 -*-
"""Phần khung của khoá Kỹ năng mềm: mô tả, danh sách lỗi tư duy, lời phản hồi.

Khoá gồm 10 module, mỗi module một kỹ năng — chín kỹ năng khớp 1-1 với Kho KNM
(282 câu MCQ, docs/Kho KNM (1).xlsx) để ngân hàng câu hỏi và đề thi dùng lại
được nguyên vẹn, cộng thêm Tư duy phản biện.

Danh sách lỗi tư duy dưới đây lớn dần theo từng module được soạn: mỗi lần nhập
thêm module, `misconception` được upsert theo `code` nên khai báo lại không sinh
bản trùng. Mã đặt tiền tố `knm.` để không đụng mã của khoá khác trong cùng DB.
"""

COURSE = {
    "title": "Kỹ năng mềm",
    "slug": "ky-nang-mem",
    "description": (
        "Khoá kỹ năng mềm dành cho sinh viên đại học và người mới đi làm. Mười module, mỗi module "
        "một kỹ năng, đi từ trong ra ngoài: bắt đầu ở nền tảng cá nhân — giá trị sống, tư duy tích "
        "cực, tư duy phản biện, quản lý thời gian — rồi mới tới các kỹ năng cần người khác mới "
        "luyện được: giao tiếp, lắng nghe, thuyết trình, thuyết phục, làm việc nhóm, và cuối cùng "
        "là viết CV cùng phỏng vấn xin việc. Thứ tự ấy có lý do: một người chưa biết mình coi trọng "
        "điều gì thì thuyết phục người khác bằng gì, và một người không quản được thời gian của "
        "mình thì không giữ được cam kết với nhóm. "
        "Khoá học không dạy mẹo ứng xử. Mỗi bài đặt một khung khái niệm có nguồn gốc rõ ràng, cho "
        "thấy khung ấy được dùng thế nào trong một tình huống học tập hoặc công sở cụ thể, rồi "
        "buộc người học tự chạy nó trên chính đời sống của mình qua ba lớp luyện tập: cá nhân, "
        "nhóm và bài tập về nhà. Mỗi bài kết bằng một bài kiểm tra ngắn, phương án sai được gắn mã "
        "lỗi tư duy để phản hồi chỉ đúng chỗ hiểu nhầm thay vì báo sai chung chung."
    ),
    "language": "vi",
    "level": "beginner",
    "category": "Kỹ năng mềm",
    "personalizationEnabled": True,
}

MISCONCEPTIONS = [
    # ── Chung cả khoá ───────────────────────────────────────────────────────
    {
        "code": "knm.skill-is-innate",
        "name": "Coi kỹ năng mềm là tính cách bẩm sinh",
        "description": (
            "Tin rằng người ta sinh ra đã hoạt ngôn hoặc đã kỷ luật, nên việc luyện tập chỉ dành cho "
            "người có sẵn tố chất. Cách nghĩ này biến mọi thất bại thành bằng chứng về bản chất mình "
            "và chấm dứt việc luyện tập ngay tại đó, trong khi phần lớn kỹ năng mềm là chuỗi hành vi "
            "quan sát được và tập được."
        ),
    },
    {
        "code": "knm.knowing-equals-doing",
        "name": "Biết khung lý thuyết là đã có kỹ năng",
        "description": (
            "Đọc hiểu một mô hình rồi coi như đã sở hữu kỹ năng tương ứng. Cảm giác hiểu bài đo độ "
            "quen thuộc với khái niệm, không đo khả năng thực hiện dưới áp lực; khoảng cách giữa hai "
            "thứ chỉ đóng lại bằng luyện tập có phản hồi."
        ),
    },
    # ── Module 1 · Giá trị sống ─────────────────────────────────────────────
    {
        "code": "knm.value-as-goal",
        "name": "Lẫn giá trị với mục tiêu",
        "description": (
            "Coi giá trị sống và mục tiêu là một, nên trả lời câu hỏi về giá trị bằng những thứ đạt "
            "được rồi gạch đi: có bằng thạc sĩ, mua được nhà, lên trưởng nhóm. Mục tiêu có điểm kết "
            "thúc và có thể đo xong; giá trị là phương hướng đi suốt đời, không bao giờ tích xong ô."
        ),
    },
    {
        "code": "knm.value-as-preference",
        "name": "Lẫn giá trị với sở thích hay cảm xúc nhất thời",
        "description": (
            "Xếp những thứ mình thích — cà phê sáng, du lịch, một môn thể thao — ngang hàng với giá "
            "trị sống. Sở thích thay đổi theo tâm trạng và hoàn cảnh, không đòi hỏi trả giá; giá trị "
            "chỉ lộ ra đúng lúc phải trả giá để giữ nó."
        ),
    },
    {
        "code": "knm.espoused-values",
        "name": "Lấy giá trị tuyên bố thay cho giá trị thật",
        "description": (
            "Nhận diện giá trị của mình bằng danh sách mình muốn tin, thay vì bằng dấu vết hành vi "
            "thực tế trong lịch, trong chi tiêu và trong những lần từ chối. Argyris và Schön gọi đây "
            "là khoảng cách giữa lý thuyết tuyên bố và lý thuyết đang dùng; ai cũng có, người tự "
            "nhận thức được là người biết đo nó."
        ),
    },
    {
        "code": "knm.value-no-priority",
        "name": "Giữ mọi giá trị ngang nhau, không xếp thứ tự",
        "description": (
            "Cho rằng tất cả những gì mình coi trọng đều quan trọng như nhau nên không cần ưu tiên. "
            "Danh sách không xếp hạng chỉ hữu ích khi mọi thứ cùng đạt được; đúng lúc phải chọn — "
            "và mọi quyết định lớn đều là lúc ấy — nó không giúp được gì."
        ),
    },
    {
        "code": "knm.self-center-is-maturity",
        "name": "Coi trọng tâm bản thân là dấu hiệu trưởng thành",
        "description": (
            "Đồng nhất việc lấy bản thân làm trung tâm mọi quyết định với sự độc lập và tự tin. "
            "Trọng tâm bản thân khiến tầm nhìn co lại quanh cái được mất trước mắt của mình và làm "
            "hỏng các mối quan hệ vốn cần có đi có lại; nó khác hẳn việc tự trọng và biết giới hạn."
        ),
    },
    {
        "code": "knm.external-center",
        "name": "Đặt trọng tâm vào thứ có thể mất",
        "description": (
            "Neo sự vững vàng của mình vào công việc, tiền bạc, một người cụ thể hay sự công nhận từ "
            "đám đông. Những trọng tâm ấy đều nằm ngoài tầm kiểm soát và đều có thể mất, nên khi "
            "chúng lung lay thì cả hệ giá trị lung lay theo."
        ),
    },
    {
        "code": "knm.circle-of-concern",
        "name": "Dồn sức vào vòng tròn quan tâm",
        "description": (
            "Đổ phần lớn năng lượng vào việc bình luận, than phiền, phân tích những chuyện mình "
            "không tác động được, rồi nhầm mức độ bức xúc với mức độ trách nhiệm. Theo Covey, năng "
            "lượng đặt ở vòng tròn quan tâm làm vòng tròn ảnh hưởng co lại."
        ),
    },
    {
        "code": "knm.proactive-is-enthusiasm",
        "name": "Hiểu chủ động là xông xáo, nhiệt tình",
        "description": (
            "Đo tính chủ động bằng độ hăng hái, số việc nhận thêm hay tốc độ phản ứng. Chủ động theo "
            "nghĩa gốc là khoảng dừng giữa kích thích và phản ứng — khả năng chọn cách đáp lại thay "
            "vì bị hoàn cảnh bấm nút; một người im lặng cân nhắc vẫn có thể chủ động hơn người phản "
            "ứng tức thì."
        ),
    },
    {
        "code": "knm.mission-as-slogan",
        "name": "Viết tuyên ngôn sứ mệnh như một khẩu hiệu",
        "description": (
            "Soạn một câu nghe hay, chung chung, đúng với mọi người — sống tử tế, không ngừng vươn "
            "lên — nên không dùng để quyết định được việc gì. Tuyên ngôn có ích là tuyên ngôn nói rõ "
            "vai trò, đóng góp cụ thể và những gì mình sẵn sàng từ chối."
        ),
    },
    {
        "code": "knm.mission-write-once",
        "name": "Viết tuyên ngôn một lần rồi thôi",
        "description": (
            "Coi bản tuyên ngôn sứ mệnh cá nhân là văn bản viết xong là xong, không cần xem lại. Vai "
            "trò, năng lực và hoàn cảnh sống thay đổi theo năm; một bản không được rà soát định kỳ "
            "sẽ lặng lẽ mô tả một người không còn tồn tại."
        ),
    },
    {
        "code": "knm.conflict-binary",
        "name": "Xung đột giá trị chỉ có hai lối: chịu đựng hoặc nghỉ việc",
        "description": (
            "Khi yêu cầu của tổ chức va vào nguyên tắc cá nhân thì chỉ thấy hai lựa chọn cực đoan, "
            "bỏ qua các bước ở giữa: làm rõ sự việc, nêu quan ngại đúng kênh, thương lượng phạm vi "
            "công việc, ghi nhận bằng văn bản. Hirschman gọi lối ở giữa ấy là lên tiếng, và nó "
            "thường được thử trước khi tính tới rời đi."
        ),
    },
    # ── Module 2 · Tư duy tích cực ──────────────────────────────────────────
    {
        "code": "knm.toxic-positivity",
        "name": "Tích cực nghĩa là không được buồn",
        "description": (
            "Hiểu tư duy tích cực thành nghĩa vụ phải vui vẻ, nên dập mọi cảm xúc khó chịu của mình "
            "và của người khác bằng những câu an ủi rỗng. Cảm xúc bị chặn không biến mất mà chỉ mất "
            "kênh xử lý; và người đang gặp chuyện thật sẽ thấy mình không được phép nói ra."
        ),
    },
    {
        "code": "knm.positive-thinking-magic",
        "name": "Chỉ cần nghĩ tích cực là chuyện sẽ tốt lên",
        "description": (
            "Coi suy nghĩ tích cực như một loại lực tác động thẳng vào thực tại, nên bỏ qua khâu hành "
            "động cụ thể. Tư duy tích cực có ích vì nó giữ cho người ta còn thử tiếp và còn nhìn thấy "
            "phương án, chứ không phải vì nó tự sinh ra kết quả."
        ),
    },
    {
        "code": "knm.emotion-from-event",
        "name": "Sự kiện gây ra cảm xúc, không có gì ở giữa",
        "description": (
            "Tin rằng chuyện xảy ra quyết định thẳng cảm xúc, nên không có chỗ nào để can thiệp. Mô "
            "hình ABC chỉ ra khâu ở giữa: cách ta diễn giải sự việc. Cùng một điểm số, hai cách diễn "
            "giải khác nhau cho hai trạng thái cảm xúc khác nhau."
        ),
    },
    {
        "code": "knm.self-label",
        "name": "Dán nhãn cố định cho bản thân",
        "description": (
            "Chuyển một kết quả cụ thể thành một phán quyết về con người mình: trượt một bài thành "
            "mình kém cỏi. Nhãn ấy vừa không mô tả được điều gì sửa được, vừa chiếm chỗ trong trí nhớ "
            "làm việc đáng lẽ dành cho việc đang làm."
        ),
    },
    {
        "code": "knm.catastrophizing",
        "name": "Thổi phồng hậu quả",
        "description": (
            "Kéo một sự việc trước mắt thành chuỗi hậu quả tồi tệ dài hạn mà không có bước trung gian "
            "nào được kiểm chứng: trượt một môn thành mất bằng, mất việc, hỏng cả đời. Đây là lỗi về "
            "phạm vi và độ bền, hai trong ba trục giải thích của Seligman."
        ),
    },
    {
        "code": "knm.criticism-as-attack",
        "name": "Coi mọi góp ý là công kích cá nhân",
        "description": (
            "Nghe nhận xét về sản phẩm thành nhận xét về giá trị con người mình, nên phản ứng bằng "
            "phòng thủ và mất luôn phần thông tin dùng được. Tách câu hỏi ai nói ra khỏi câu hỏi điều "
            "được nói có đúng phần nào không là kỹ năng học được."
        ),
    },
    {
        "code": "knm.fixed-mindset",
        "name": "Năng lực là thứ cố định",
        "description": (
            "Tin rằng thông minh và năng khiếu là lượng trời cho, nên nỗ lực bị coi là bằng chứng của "
            "sự kém cỏi và thất bại bị coi là phán quyết cuối cùng. Cách tin này khiến người ta né "
            "nhiệm vụ khó — đúng loại nhiệm vụ tạo ra tiến bộ."
        ),
    },
    {
        "code": "knm.compare-upward",
        "name": "Lấy người khác làm thước đo tiến bộ của mình",
        "description": (
            "Đo mình bằng thành tích của người xung quanh hoặc bản dựng của họ trên mạng xã hội, thay "
            "vì bằng chính mình của ba tháng trước. Thước đo ấy đổi liên tục theo người mình gặp và "
            "không nói được bước tiếp theo cần làm gì."
        ),
    },
    {
        "code": "knm.self-compassion-is-weak",
        "name": "Tự trắc ẩn là nuông chiều bản thân",
        "description": (
            "Sợ rằng đối xử tử tế với chính mình sẽ làm mất động lực, nên chọn tự đay nghiến như một "
            "cách thúc ép. Nghiên cứu của Neff cho thấy ngược lại: người tự trắc ẩn nhận lỗi dễ hơn và "
            "quay lại làm tiếp nhanh hơn, vì họ không phải tốn sức bảo vệ hình ảnh bản thân."
        ),
    },
    {
        "code": "knm.mental-health-willpower",
        "name": "Trầm cảm và lo âu là chuyện của ý chí",
        "description": (
            "Coi các rối loạn tâm lý là trạng thái tinh thần yếu, chỉ cần nghĩ tích cực hơn là hết. "
            "Đây là chỗ tư duy tích cực bị dùng sai nguy hiểm nhất: nó làm chậm việc tìm trợ giúp "
            "chuyên môn, trong khi các dấu hiệu kéo dài trên hai tuần cần được đánh giá bởi người có "
            "chuyên môn."
        ),
    },
    # ── Module 3 · Tư duy phản biện ─────────────────────────────────────────
    {
        "code": "knm.critical-is-negative",
        "name": "Phản biện là bắt bẻ",
        "description": (
            "Hiểu tư duy phản biện thành thái độ hoài nghi mọi thứ và tìm lỗi của người khác. Phản "
            "biện là quy trình kiểm tra chất lượng của một lập luận — kể cả lập luận của chính mình — "
            "và nó kết thúc bằng một kết luận có cơ sở, không phải bằng việc hạ bệ ai."
        ),
    },
    {
        "code": "knm.opinion-as-evidence",
        "name": "Lấy ý kiến hoặc cảm nhận làm bằng chứng",
        "description": (
            "Đưa niềm tin cá nhân, cảm giác hoặc mức độ chắc chắn của mình vào chỗ đáng lẽ phải là dữ "
            "liệu quan sát được. Mức độ tự tin không phải thước đo mức độ đúng; một khẳng định chỉ "
            "đứng được khi có bằng chứng người khác kiểm lại được."
        ),
    },
    {
        "code": "knm.confirmation-bias",
        "name": "Chỉ tìm thứ ủng hộ điều mình đã tin",
        "description": (
            "Tìm, nhớ và tin những thông tin khớp với kết luận sẵn có, đồng thời đòi hỏi tiêu chuẩn "
            "khắt khe hơn hẳn với thông tin trái chiều. Kết quả là càng đọc nhiều càng chắc chắn hơn "
            "mà không hề chính xác hơn."
        ),
    },
    {
        "code": "knm.correlation-causation",
        "name": "Thấy đi cùng nhau là kết luận cái này gây ra cái kia",
        "description": (
            "Suy ra quan hệ nhân quả từ việc hai hiện tượng cùng tăng hoặc cùng giảm, bỏ qua ba khả "
            "năng khác: chiều ngược lại, một yếu tố thứ ba tác động lên cả hai, hoặc trùng hợp ngẫu "
            "nhiên."
        ),
    },
    {
        "code": "knm.authority-or-crowd",
        "name": "Đúng vì người nổi tiếng nói hoặc vì nhiều người tin",
        "description": (
            "Thay việc xem bằng chứng bằng việc xem ai nói và bao nhiêu người đồng ý. Uy tín của "
            "người nói chỉ là lý do để nghe kỹ hơn, không phải lý do để tin; số lượt chia sẻ đo mức "
            "lan truyền chứ không đo mức đúng."
        ),
    },
    {
        "code": "knm.anecdote-as-proof",
        "name": "Lấy một trường hợp làm bằng chứng chung",
        "description": (
            "Khái quát từ một câu chuyện sinh động — người quen, bản thân, một bài đăng — thành quy "
            "luật cho số đông. Trường hợp cá biệt nêu ra được giả thuyết, nhưng không nói được nó "
            "đúng với bao nhiêu phần trăm và trong điều kiện nào."
        ),
    },
    {
        "code": "knm.straw-man",
        "name": "Bẻ lại phiên bản méo của lập luận đối phương",
        "description": (
            "Đơn giản hoá hoặc phóng đại ý người khác thành một phiên bản dễ đánh đổ rồi công kích "
            "phiên bản ấy. Thắng được bản méo không nói lên điều gì về bản gốc, và người đối thoại thì "
            "mất lý do tiếp tục nói chuyện."
        ),
    },
    {
        "code": "knm.false-dilemma",
        "name": "Chỉ thấy hai lựa chọn",
        "description": (
            "Trình bày một vấn đề như thể chỉ có hai đường đi loại trừ nhau, trong khi còn các phương "
            "án trung gian hoặc phương án thứ ba chưa được nêu. Cách đóng khung này ép người nghe "
            "chọn nhanh và chọn hẹp."
        ),
    },
    {
        "code": "knm.vertical-reading",
        "name": "Đánh giá một nguồn bằng cách đọc kỹ chính nguồn đó",
        "description": (
            "Tin hay không tin một trang dựa vào giao diện, giọng văn và phần giới thiệu của chính "
            "trang ấy. Nghiên cứu về đọc ngang cho thấy người kiểm chứng chuyên nghiệp làm ngược lại: "
            "rời trang ra, xem nơi khác nói gì về nó, rồi mới quay lại."
        ),
    },
    {
        "code": "knm.ai-fluency-truth",
        "name": "Văn trôi chảy của AI nghĩa là thông tin đúng",
        "description": (
            "Lấy độ mạch lạc, sự tự tin và cách trình bày có trích dẫn của một câu trả lời do AI sinh "
            "làm dấu hiệu chính xác. Mô hình ngôn ngữ tối ưu cho tính hợp lý bề mặt, nên nó bịa được "
            "cả tên tác giả, năm và số trang trong khi vẫn đọc rất xuôi."
        ),
    },
    # ── Module 4 · Quản lý thời gian ────────────────────────────────────────
    {"code": "knm.busy-equals-productive", "name": "Bận rộn nghĩa là hiệu quả", "description": "Lấy số việc đã làm và số giờ đã bỏ ra làm thước đo, thay vì lấy kết quả tạo ra. Người bận rộn cả ngày với việc khẩn cấp của người khác vẫn có thể không nhích được mục tiêu nào của mình."},
    {"code": "knm.urgent-equals-important", "name": "Lẫn khẩn cấp với quan trọng", "description": "Coi mọi việc đang réo là việc phải làm trước. Khẩn cấp nói về thời hạn, quan trọng nói về mức đóng góp cho mục tiêu; việc quan trọng thường im lặng, nên nó luôn thua trong cuộc cạnh tranh sự chú ý."},
    {"code": "knm.no-time-to-plan", "name": "Không có thời gian để lập kế hoạch", "description": "Bỏ khâu lập kế hoạch vì đang quá bận. Lập kế hoạch là việc điển hình của ô quan trọng nhưng không khẩn cấp: bỏ nó thì ô khẩn cấp phình ra, và càng phình thì càng không còn chỗ để lập kế hoạch."},
    {"code": "knm.multitask-efficient", "name": "Đa nhiệm giúp làm được nhiều việc hơn", "description": "Tin rằng làm nhiều việc cùng lúc tiết kiệm thời gian. Não người chuyển qua lại giữa các việc chứ không chạy song song, và mỗi lần chuyển đều mất chi phí khởi động lại — tổng thời gian dài hơn, lỗi nhiều hơn."},
    {"code": "knm.goal-vague", "name": "Mục tiêu chung chung vẫn là mục tiêu", "description": "Đặt mục tiêu kiểu học giỏi hơn, chăm chỉ hơn — không đo được nên không biết đã đạt chưa, và không suy ra được việc phải làm hôm nay."},
    {"code": "knm.more-goals-better", "name": "Càng nhiều mục tiêu càng tốt", "description": "Đặt cùng lúc quá nhiều mục tiêu cho một học kỳ rồi đuối ở tuần thứ tư. Số mục tiêu chia nhau một quỹ thời gian cố định; quá nhiều mục tiêu đồng nghĩa không mục tiêu nào đủ thời gian để về đích."},
    {"code": "knm.saying-no-rude", "name": "Nói không là bất lịch sự", "description": "Nhận mọi lời nhờ vả vì sợ mất lòng, rồi trễ hạn với chính những việc đã cam kết. Nói không đúng cách bảo vệ các cam kết đang có; nhận bừa rồi làm hỏng mới là thứ làm mất lòng tin."},
    {"code": "knm.procrastination-lazy", "name": "Trì hoãn là do lười", "description": "Quy trì hoãn về thiếu ý chí, nên giải pháp duy nhất nghĩ ra được là tự trách. Trì hoãn phần lớn là cách né cảm xúc khó chịu gắn với nhiệm vụ — mơ hồ, sợ làm dở, chán — nên cách chữa nằm ở việc làm rõ và chia nhỏ bước đầu tiên."},
    {"code": "knm.always-available", "name": "Luôn sẵn sàng trả lời ngay mới là chuyên nghiệp", "description": "Để thông báo mở suốt và trả lời tức thì, coi đó là dấu hiệu trách nhiệm. Mỗi lần gián đoạn tốn thêm thời gian lấy lại mạch tập trung; thoả thuận trước về thời gian phản hồi mới là cách làm chuyên nghiệp."},
    # ── Module 5 · Giao tiếp hiệu quả ───────────────────────────────────────
    {"code": "knm.sent-equals-received", "name": "Đã nói là đã truyền đạt", "description": "Coi việc phát ra thông điệp là hoàn thành giao tiếp, bỏ qua khâu người nhận giải mã và phản hồi. Thông điệp chỉ tồn tại ở dạng người kia hiểu, không phải dạng ta phát ra."},
    {"code": "knm.mehrabian-93", "name": "Nội dung lời nói chỉ chiếm 7%", "description": "Áp tỉ lệ 7–38–55 của Mehrabian cho mọi tình huống giao tiếp. Nghiên cứu gốc chỉ nói về việc truyền đạt thái độ và cảm xúc khi lời nói mâu thuẫn với giọng điệu và nét mặt — không nói rằng nội dung chỉ đáng 7 phần trăm."},
    {"code": "knm.channel-default", "name": "Dùng một kênh cho mọi việc", "description": "Nhắn tin cho chuyện phức tạp, gửi email cho chuyện nhạy cảm, họp cho chuyện chỉ cần một dòng thông báo. Kênh phải chọn theo độ phức tạp và độ nhạy cảm của nội dung, không theo thói quen của người gửi."},
    {"code": "knm.jargon-professional", "name": "Dùng thuật ngữ cho ra vẻ chuyên nghiệp", "description": "Chèn biệt ngữ và từ chuyên ngành khi nói với người ngoài ngành, tưởng làm tăng uy tín. Thực tế nó tăng nhiễu ngữ nghĩa: người nghe hoặc hiểu sai, hoặc ngại hỏi lại."},
    {"code": "knm.single-cue-decoding", "name": "Đọc một cử chỉ đơn lẻ như bằng chứng chắc chắn", "description": "Kết luận khoanh tay là phòng thủ, nhìn đi chỗ khác là nói dối. Tín hiệu phi ngôn ngữ chỉ có nghĩa khi đọc theo cụm, đặt trong bối cảnh, và tốt nhất là kiểm lại bằng một câu hỏi."},
    {"code": "knm.silence-means-understood", "name": "Không ai hỏi tức là mọi người đã hiểu", "description": "Lấy sự im lặng làm bằng chứng thông điệp đã tới nơi. Im lặng thường có nghĩa người nghe chưa kịp nghĩ ra câu hỏi, hoặc ngại hỏi vì sợ bị coi là chậm hiểu."},
    {"code": "knm.assertive-is-aggressive", "name": "Quyết đoán nghĩa là nói mạnh, át người khác", "description": "Lẫn quyết đoán với hung hăng, hoặc lẫn lịch sự với phục tùng. Quyết đoán là nói rõ nhu cầu và giới hạn của mình mà vẫn tôn trọng nhu cầu của người kia — hai vế phải cùng có mặt."},
    {"code": "knm.bad-news-vague", "name": "Báo tin xấu thì nên nói vòng cho nhẹ", "description": "Nói tránh, giấu bớt hoặc trì hoãn khi phải báo tin không vui, tưởng như vậy là tử tế. Người nghe vẫn nhận ra có chuyện, chỉ mất thêm thời gian đoán mò và mất niềm tin khi biết sự thật bị giữ lại."},
    {"code": "knm.reply-in-anger", "name": "Trả lời khiếu nại bằng phòng thủ", "description": "Đáp lại lời phàn nàn gay gắt bằng cách thanh minh hoặc phản công ngay. Việc cần làm trước là ghi nhận sự việc và tách phần dữ kiện ra khỏi giọng điệu, rồi mới trả lời phần dữ kiện."},
    {"code": "knm.culture-universal", "name": "Quy tắc phi ngôn ngữ giống nhau ở mọi nơi", "description": "Áp thẳng thói quen giao tiếp của mình sang bối cảnh văn hoá khác: khoảng cách đứng, mức độ nhìn thẳng, cách nói thẳng hay nói vòng đều khác nhau giữa các nền văn hoá và giữa các thế hệ."},
    # ── Module 6 · Kỹ năng lắng nghe ────────────────────────────────────────
    {"code": "knm.hearing-is-listening", "name": "Nghe thấy là đã lắng nghe", "description": "Coi việc âm thanh lọt vào tai và mình có mặt trong cuộc trò chuyện là đã lắng nghe. Nghe là hiện tượng sinh lý, lắng nghe là hoạt động có chủ đích gồm tập trung, giải mã, ghi nhớ và phản hồi."},
    {"code": "knm.listen-to-reply", "name": "Nghe để chờ tới lượt nói", "description": "Vừa nghe vừa soạn sẵn câu đáp trong đầu, nên chỉ bắt được phần thông tin phục vụ cho câu đáp ấy. Người nói cảm nhận được điều này gần như ngay lập tức, và họ ngừng nói phần quan trọng."},
    {"code": "knm.selective-listening", "name": "Nghe chọn lọc rồi tưởng đã hiểu hết", "description": "Chỉ tiếp nhận phần khớp với điều mình quan tâm hoặc đã tin, bỏ qua phần còn lại, rồi kết luận như thể đã nghe trọn vẹn."},
    {"code": "knm.advice-too-early", "name": "Đưa lời khuyên ngay khi người khác vừa kể", "description": "Nhảy vào giải pháp trước khi người kia kể xong và trước khi họ được ghi nhận cảm xúc. Lời khuyên sớm thường trượt vì chưa đủ thông tin, và nó gửi đi thông điệp rằng vấn đề của họ đơn giản."},
    {"code": "knm.interrupt-to-help", "name": "Ngắt lời để đẩy nhanh câu chuyện", "description": "Chen vào để tóm tắt hộ, đoán hộ hoặc kéo người nói đi nhanh hơn. Mỗi lần ngắt làm mất mạch của người nói và làm mất luôn phần thông tin họ chưa kịp tới."},
    {"code": "knm.silence-is-awkward", "name": "Im lặng là khoảng trống phải lấp ngay", "description": "Vội nói tiếp mỗi khi cuộc trò chuyện chùng xuống. Khoảng dừng vài giây là lúc người kia đang sắp xếp ý hoặc chạm vào điều khó nói; lấp nó lại là cắt đúng phần sâu nhất."},
    {"code": "knm.empathy-is-agreement", "name": "Thấu cảm nghĩa là đồng ý", "description": "Ngại phản ánh cảm xúc của người khác vì sợ như vậy là thừa nhận họ đúng. Thấu cảm là hiểu được họ đang thấy thế nào và vì sao, hoàn toàn không đòi hỏi ta phải đồng tình với kết luận của họ."},
    {"code": "knm.closed-questions", "name": "Hỏi bằng câu đóng rồi than người ta ít nói", "description": "Dùng các câu hỏi chỉ trả lời được có hoặc không, rồi kết luận người kia không muốn chia sẻ. Câu hỏi mở bắt đầu bằng thế nào, điều gì, kể thêm mở ra thông tin mà câu đóng chặn lại."},
    # ── Module 7 · Thuyết trình hiệu quả ────────────────────────────────────
    {"code": "knm.slide-is-document", "name": "Dùng slide như một tài liệu để đọc", "description": "Nhồi hết nội dung vào slide rồi đứng đọc lại. Khán giả đọc nhanh hơn người nói, nên họ đọc xong trước và ngừng nghe; slide là chỗ dựa thị giác, tài liệu chi tiết nên phát riêng."},
    {"code": "knm.info-not-message", "name": "Trình bày thông tin thay vì một thông điệp", "description": "Đổ mọi thứ mình biết vào bài nói mà không chọn ra điều muốn người nghe nhớ và làm. Thông tin là nguyên liệu; thông điệp là một câu mà nếu khán giả chỉ nhớ một thứ thì đó là thứ đó."},
    {"code": "knm.audience-is-me", "name": "Soạn bài cho chính mình, không cho khán giả", "description": "Chọn nội dung, thuật ngữ và độ sâu theo mức hiểu biết của người trình bày. Cùng một đề tài phải được kể khác đi cho hội đồng chuyên môn và cho người ngoài ngành."},
    {"code": "knm.no-need-rehearse", "name": "Nắm nội dung rồi thì không cần tập trước", "description": "Bỏ khâu tập vì đã hiểu bài. Tập nói to là cách duy nhất phát hiện chỗ ý nhảy, chỗ hụt hơi và bài quá giờ — ba lỗi không lộ ra khi chỉ đọc thầm."},
    {"code": "knm.qa-must-know-all", "name": "Bị hỏi khó thì phải trả lời cho bằng được", "description": "Chế câu trả lời khi không biết, vì sợ mất uy tín. Người nghe có chuyên môn nhận ra ngay; câu nhận chưa nắm phần đó kèm cam kết tìm hiểu và phản hồi lại giữ được uy tín tốt hơn nhiều."},
    {"code": "knm.rush-when-over-time", "name": "Quá giờ thì nói nhanh cho kịp hết slide", "description": "Tăng tốc để chạy hết nội dung đã chuẩn bị. Kết quả là phần kết — chỗ chốt thông điệp — bị nuốt mất, trong khi bỏ bớt vài slide giữa bài thì không ai nhận ra."},
    # ── Module 4 · bổ sung sau khi đối chiếu tài liệu LEAP ──────────────────
    {"code": "knm.planning-fallacy", "name": "Ước lượng thời gian theo hướng lạc quan", "description": "Tin rằng lần này mình sẽ làm nhanh hơn lần trước, dù chưa có gì thay đổi về cách làm. Kahneman và Tversky gọi đây là nguỵ biện lập kế hoạch: người ta thường xuyên ước lượng thiếu thời gian cần cho một việc, kể cả khi đã biết lần trước mất bao lâu."},
    {"code": "knm.schedule-no-buffer", "name": "Xếp lịch kín không chừa khoảng đệm", "description": "Lấp đầy mọi khoảng trống trong lịch, coi khoảng trống là lãng phí. Một việc trễ hai mươi phút sẽ đổ dây chuyền sang toàn bộ phần còn lại của ngày, và cả lịch mất tác dụng chỉ sau một sự cố nhỏ."},
    {"code": "knm.two-calendars", "name": "Tách lịch học và lịch cá nhân thành hai nơi", "description": "Giữ hai cuốn lịch riêng cho việc học và việc riêng, nên không nơi nào cho thấy bức tranh đầy đủ. Kết quả là trùng lịch, hoặc nhận thêm cam kết mà quên mất buổi tối hôm đó đã có việc."},
    # ── Module 8 · Nghệ thuật thuyết phục ───────────────────────────────────
    {"code": "knm.persuasion-is-manipulation", "name": "Thuyết phục và thao túng là một", "description": "Coi hai thứ này giống nhau, nên hoặc từ chối học thuyết phục vì thấy nó không tử tế, hoặc dùng thao túng rồi gọi đó là kỹ năng. Khác biệt nằm ở ba chỗ kiểm được: thông tin có trung thực không, người kia có còn tự do chọn không, và kết quả có phục vụ lợi ích của họ không."},
    {"code": "knm.persuade-by-arguing-harder", "name": "Cứ thêm lý lẽ là thuyết phục được", "description": "Tin rằng người kia chưa đồng ý là vì chưa đủ thông tin, nên chồng thêm lập luận và nói mạnh hơn. Phần lớn bất đồng không nằm ở thiếu dữ kiện mà ở lợi ích, cảm xúc hoặc lòng tin — chồng lý lẽ vào đó chỉ làm đối phương phòng thủ."},
    {"code": "knm.features-not-benefits", "name": "Kể tính năng thay vì nói lợi ích của người nghe", "description": "Liệt kê những gì sản phẩm hoặc đề xuất của mình có, thay vì nói nó thay đổi điều gì trong đời sống của người nghe. Người ta không mua tính năng, họ mua kết quả mà tính năng ấy tạo ra cho họ."},
    {"code": "knm.reciprocity-small-gift", "name": "Quà nhỏ thì không ảnh hưởng gì", "description": "Nghĩ rằng một món quà nhỏ, một ly nước, một lời khen hay một ưu đãi dùng thử không tác động tới quyết định của mình. Nguyên tắc đáp trả hoạt động mạnh và gần như tự động, không tỉ lệ thuận với giá trị món quà — và nó vẫn chạy cả khi món quà không ai yêu cầu."},
    {"code": "knm.consistency-trap", "name": "Đã trót nói có thì phải theo tới cùng", "description": "Giữ nhất quán với một cam kết cũ dù thông tin đã đổi, vì sợ bị coi là người thay đổi. Nhất quán là phẩm chất tốt khi nó theo giá trị của mình; nó thành cái bẫy khi người khác dùng một cam kết nhỏ ban đầu để kéo ta tới một cam kết lớn ta không định nhận."},
    {"code": "knm.authority-symbols", "name": "Nhầm dấu hiệu uy quyền với chuyên môn thật", "description": "Tin ngay khi thấy chức danh, đồng phục, bằng cấp treo tường hay lượng người theo dõi lớn. Đó là các dấu hiệu, và dấu hiệu thì dựng được — câu hỏi vẫn là người này có chuyên môn đúng lĩnh vực đang bàn không, và họ được lợi gì nếu ta tin."},
    {"code": "knm.scarcity-always-real", "name": "Tin mọi thông báo khan hiếm là thật", "description": "Phản ứng ngay với đồng hồ đếm ngược, dòng chữ chỉ còn hai suất, ưu đãi hết hạn trong hai giờ. Phần lớn các tín hiệu ấy do người bán đặt ra và lặp lại hằng tuần; điều chúng tạo ra là cảm giác gấp, không phải giá trị."},
    {"code": "knm.liking-equals-credible", "name": "Dễ mến nghĩa là đáng tin về nội dung", "description": "Chuyển sự thiện cảm với người nói thành sự tin tưởng vào điều họ nói. Thiện cảm nói lên mối quan hệ, không nói gì về chất lượng bằng chứng — và đó chính là lý do nó được dùng nhiều trong quảng cáo."},
    {"code": "knm.one-size-persuasion", "name": "Một cách thuyết phục dùng cho mọi người", "description": "Lặp lại đúng một kiểu lập luận cho mọi đối tượng. Điều thuyết phục một sinh viên năm nhất khác điều thuyết phục một đồng nghiệp hai mươi năm kinh nghiệm; không đọc được người nghe thì mọi kỹ thuật đều trượt."},
    # ── Module 9 · Làm việc nhóm ────────────────────────────────────────────
    {"code": "knm.team-is-division", "name": "Làm việc nhóm là chia việc rồi ghép lại", "description": "Coi nhóm chỉ là cách chia nhỏ khối lượng: mỗi người làm phần của mình rồi dán vào một file. Cách này bỏ mất thứ duy nhất khiến nhóm hơn tổng các cá nhân — sự bổ trợ, phản biện và trách nhiệm chung với kết quả cuối cùng."},
    {"code": "knm.wait-for-assignment", "name": "Chờ được phân công mới làm", "description": "Ngồi đợi trưởng nhóm giao việc rồi mới bắt đầu, và chỉ làm đúng phần được giao. Đây là biểu hiện của mô thức phụ thuộc trong nhóm; nó đẩy toàn bộ chi phí điều phối sang một người và làm nhóm chậm ở mọi khâu chuyển tiếp."},
    {"code": "knm.conflict-is-bad", "name": "Xung đột trong nhóm là dấu hiệu nhóm hỏng", "description": "Coi mọi bất đồng là điều cần dập tắt. Giai đoạn sóng gió là giai đoạn bắt buộc trong quá trình phát triển nhóm: đó là lúc các kỳ vọng ngầm được nói ra và chuẩn làm việc chung được hình thành. Nhóm không bao giờ tranh luận thường là nhóm có người đang im lặng."},
    {"code": "knm.avoid-conflict", "name": "Né tránh để giữ hoà khí", "description": "Chọn im lặng khi thấy vấn đề, mong nó tự qua. Né tránh giữ được không khí dễ chịu trong ngắn hạn và trả giá ở hạn nộp: vấn đề vẫn còn, cộng thêm sự bực bội đã tích lại và thời gian đã mất."},
    {"code": "knm.carry-the-team", "name": "Làm hộ hết cho nhanh", "description": "Thấy đồng đội chậm thì tự làm luôn phần của họ. Cách này cứu được một hạn nộp và tạo ra ba vấn đề: người kia không học được gì, bạn kiệt sức, và nhóm hình thành thói quen ỷ lại vào một người."},
    {"code": "knm.silence-is-agreement", "name": "Im lặng trong họp nghĩa là đồng ý", "description": "Coi việc không ai phản đối là cả nhóm đã đồng thuận. Im lặng thường có nghĩa người ta chưa kịp nghĩ, ngại nói trước người có vị thế hơn, hoặc đã bỏ cuộc — và sự bất đồng chưa nói ra sẽ quay lại ở khâu thực hiện."},
    {"code": "knm.leader-decides-all", "name": "Trưởng nhóm là người quyết hết và làm nhiều nhất", "description": "Hiểu vai trò trưởng nhóm thành người giỏi nhất, làm nhiều nhất, quyết mọi việc. Việc chính của trưởng nhóm là làm rõ mục tiêu, phân công đúng năng lực, gỡ vướng và giữ nhịp — chứ không phải gánh phần lớn khối lượng."},
    {"code": "knm.role-by-title", "name": "Giao vai trò theo quen biết thay vì theo năng lực", "description": "Chọn người vào vai trò vì thân quen, vì họ hay xung phong, hoặc vì chức danh sẵn có. Vai trò trong nhóm nên được giao theo thế mạnh, sở thích và mức sẵn sàng của từng người, và nên nói rõ kỳ vọng đi kèm."},
    {"code": "knm.blame-the-person", "name": "Quy kết tính cách thay vì hỏi nguyên nhân", "description": "Kết luận người trễ hạn là vô trách nhiệm, rồi xử lý bằng thái độ. Cùng một hành vi có nhiều nguyên nhân — quá tải, hiểu sai yêu cầu, vướng việc riêng — và mỗi nguyên nhân cần một cách gỡ khác nhau."},
    # ── Module 10 · CV và phỏng vấn ─────────────────────────────────────────
    {"code": "knm.cv-one-for-all", "name": "Một CV gửi cho mọi vị trí", "description": "Dùng chung một bản cho mọi nơi ứng tuyển. Nhà tuyển dụng đọc CV để tìm sự khớp với mô tả công việc cụ thể của họ; một bản chung chung buộc họ tự đi tìm phần liên quan, và phần lớn sẽ không làm việc đó."},
    {"code": "knm.cv-duties-not-results", "name": "Liệt kê nhiệm vụ thay vì kết quả", "description": "Viết những việc mình từng được giao mà không nói kết quả tạo ra. Câu chịu trách nhiệm quản lý fanpage không nói được gì; tăng lượng tương tác 40% trong ba tháng nhờ đổi lịch đăng thì kiểm được và so sánh được."},
    {"code": "knm.cv-longer-better", "name": "CV càng dài càng chứng tỏ nhiều kinh nghiệm", "description": "Nhồi mọi hoạt động từng tham gia vào CV. Người đọc lướt bản đầu tiên trong vài chục giây; độ dài làm loãng phần quan trọng, và với sinh viên mới ra trường thì một trang là đủ."},
    {"code": "knm.weakness-fake", "name": "Trả lời điểm yếu bằng ưu điểm trá hình", "description": "Nói em quá cầu toàn hoặc em làm việc quá nhiều. Người phỏng vấn nghe câu này hằng ngày và đọc nó thành thiếu tự nhận thức hoặc thiếu trung thực; câu trả lời tốt nêu một điểm yếu thật, không chí mạng với vị trí, kèm việc mình đang làm để cải thiện."},
    {"code": "knm.no-questions-asked", "name": "Không hỏi lại nhà tuyển dụng câu nào", "description": "Trả lời không có câu hỏi gì ạ khi được mời hỏi. Phần này là cơ hội cuối để thể hiện mình đã tìm hiểu và để kiểm tra xem nơi ấy có hợp với mình không — bỏ qua nó thường được đọc là thiếu quan tâm."},
    {"code": "knm.interview-improvise", "name": "Không cần chuẩn bị, vào rồi ứng biến", "description": "Tin rằng nói năng tự nhiên là đủ. Các câu hỏi phỏng vấn lặp lại tới mức dự đoán được; chuẩn bị trước ba tới năm câu chuyện có cấu trúc là khác biệt lớn nhất giữa hai ứng viên ngang trình độ."},
]

FEEDBACK_TEMPLATES = [
    {
        "misconception": "knm.skill-is-innate",
        "body": (
            "Hãy tách tính cách khỏi hành vi. Bạn không cần trở thành người hướng ngoại để hỏi lại "
            "một câu cho rõ ý, hay để viết ba dòng tóm tắt cuộc họp. Kỹ năng mềm được đo bằng những "
            "hành vi cụ thể như thế, và hành vi thì tập được."
        ),
        "priority": 10,
    },
    {
        "misconception": "knm.knowing-equals-doing",
        "body": (
            "Đọc hiểu mô hình mới là bước đầu. Hãy chọn một tình huống thật trong tuần này, chạy "
            "khung vừa học vào đó, rồi ghi lại chỗ nó vướng — chính chỗ vướng ấy là phần bạn chưa có "
            "kỹ năng, chứ không phải phần bạn chưa hiểu."
        ),
        "priority": 10,
    },
    {
        "misconception": "knm.value-as-goal",
        "body": (
            "Thử phép kiểm tra này: thứ bạn vừa nêu có thể tích ô hoàn thành được không? Nếu có, đó "
            "là mục tiêu. Giá trị là hướng đi đằng sau mục tiêu ấy — thứ vẫn còn nguyên sau khi bạn "
            "đã đạt được nó, và vẫn còn nguyên nếu bạn trượt."
        ),
        "priority": 10,
    },
    {
        "misconception": "knm.value-as-preference",
        "body": (
            "Sở thích là thứ bạn chọn khi mọi việc thuận lợi; giá trị là thứ bạn giữ khi phải trả "
            "giá. Hãy hỏi lại: giữ điều này, bạn mất gì? Không mất gì thì nhiều khả năng đó mới là "
            "một sở thích."
        ),
        "priority": 10,
    },
    {
        "misconception": "knm.espoused-values",
        "body": (
            "Đừng hỏi mình coi trọng điều gì — hãy đọc dấu vết. Ba tuần gần nhất trong lịch, trong "
            "chi tiêu và trong những lời bạn đã từ chối cho biết giá trị thật của bạn chính xác hơn "
            "bất kỳ danh sách nào bạn tự khai."
        ),
        "priority": 10,
    },
    {
        "misconception": "knm.value-no-priority",
        "body": (
            "Một danh sách không xếp hạng chỉ dùng được khi không phải chọn. Hãy ép mình so từng cặp "
            "và giữ lại tối đa năm giá trị; thứ tự ấy chính là công cụ ra quyết định khi hai điều "
            "tốt loại trừ nhau."
        ),
        "priority": 10,
    },
    {
        "misconception": "knm.self-center-is-maturity",
        "body": (
            "Tự trọng khác với lấy mình làm trung tâm. Người có trọng tâm bản thân đo mọi việc bằng "
            "được mất trước mắt của riêng mình, nên tầm nhìn ngắn lại và quan hệ mòn dần — đó là một "
            "trọng tâm mong manh, không phải dấu hiệu độc lập."
        ),
        "priority": 10,
    },
    {
        "misconception": "knm.external-center",
        "body": (
            "Hãy hỏi: trọng tâm này có thể mất không? Công việc, thu nhập, một người, sự tán thưởng "
            "— tất cả đều có thể mất, và mất tới đâu thì bạn chông chênh tới đó. Nguyên tắc thì "
            "không ai lấy đi được."
        ),
        "priority": 10,
    },
    {
        "misconception": "knm.circle-of-concern",
        "body": (
            "Hãy chia đôi tờ giấy: bên trái những gì bạn tác động được, bên phải những gì chỉ có thể "
            "lo lắng. Mỗi giờ dồn vào cột phải là một giờ không tiêu ở cột trái — và cột trái chính "
            "là phần duy nhất nở ra được khi bạn làm việc trong đó."
        ),
        "priority": 10,
    },
    {
        "misconception": "knm.proactive-is-enthusiasm",
        "body": (
            "Chủ động không đo bằng độ hăng hái mà bằng khoảng dừng: giữa việc xảy ra và việc bạn "
            "đáp lại, bạn có kịp chọn không? Nhận thêm việc trong lúc bực bội vẫn là phản ứng; im "
            "lặng ba mươi giây rồi hỏi một câu đúng chỗ mới là chủ động."
        ),
        "priority": 10,
    },
    {
        "misconception": "knm.mission-as-slogan",
        "body": (
            "Phép thử cho một tuyên ngôn: nó có giúp bạn từ chối được điều gì không? Câu nào cũng "
            "đúng với mọi người thì không hướng dẫn được ai. Hãy viết lại kèm vai trò cụ thể, đóng "
            "góp cụ thể và ít nhất một thứ bạn sẽ nói không."
        ),
        "priority": 10,
    },
    {
        "misconception": "knm.mission-write-once",
        "body": (
            "Đặt lịch xem lại tuyên ngôn mỗi sáu tháng, và xem lại ngay khi đổi vai trò lớn. Không "
            "phải vì giá trị đổi xoành xoạch, mà vì cách bạn sống theo giá trị ấy phải đổi khi hoàn "
            "cảnh đổi."
        ),
        "priority": 10,
    },
    {
        "misconception": "knm.conflict-binary",
        "body": (
            "Giữa chịu đựng và nghỉ việc còn ba bước: làm rõ yêu cầu thật sự là gì, nêu quan ngại "
            "đúng kênh và đúng người, thương lượng lại phạm vi phần việc. Hãy đi hết các bước ấy — "
            "và ghi lại — trước khi tính tới lựa chọn cuối cùng."
        ),
        "priority": 10,
    },
    # ── Module 2 ────────────────────────────────────────────────────────────
    {"misconception": "knm.toxic-positivity", "body": "Tích cực không phải là cấm buồn. Hãy gọi đúng tên cảm xúc trước — thất vọng, lo, tức — rồi mới hỏi bước tiếp theo làm gì. Bỏ qua bước gọi tên thì cảm xúc không mất đi, nó chỉ chuyển sang chỗ khác và thường đắt hơn.", "priority": 10},
    {"misconception": "knm.positive-thinking-magic", "body": "Suy nghĩ tích cực không tự làm ra kết quả; nó giữ cho bạn còn thử tiếp và còn nhìn ra phương án. Hãy kiểm bằng câu hỏi này: sau suy nghĩ ấy, việc cụ thể nào trong 24 giờ tới thay đổi? Không có việc nào thì mới chỉ có tâm trạng, chưa có tư duy.", "priority": 10},
    {"misconception": "knm.emotion-from-event", "body": "Giữa sự việc và cảm xúc luôn có một khâu: cách bạn diễn giải. Hãy viết ra ba dòng — chuyện gì xảy ra, tôi đang tự nói gì với mình, tôi thấy thế nào. Khâu giữa là chỗ duy nhất sửa được, và nó chỉ hiện ra khi được viết ra.", "priority": 10},
    {"misconception": "knm.self-label", "body": "Đổi nhãn thành mô tả: thay vì mình kém, hãy viết mình chưa làm được phần nào, thiếu cái gì. Nhãn không sửa được; mô tả thì chỉ thẳng vào việc cần làm tiếp.", "priority": 10},
    {"misconception": "knm.catastrophizing", "body": "Hãy kiểm ba trục: chuyện này kéo dài bao lâu, lan tới bao nhiêu phần đời bạn, và bao nhiêu phần thật sự do bạn. Thổi phồng gần như luôn sai ở trục thứ nhất và thứ hai — hãy viết ra hậu quả thật sự trong ba tháng tới, cụ thể và có thể kiểm.", "priority": 10},
    {"misconception": "knm.criticism-as-attack", "body": "Tách hai câu hỏi: người ta nói với thái độ thế nào, và trong đó phần nào đúng. Phần đúng dùng được kể cả khi thái độ khó nghe. Hãy hỏi lại một câu cụ thể — chỗ nào chưa đạt, sửa theo hướng nào — thay vì phản ứng với giọng nói.", "priority": 10},
    {"misconception": "knm.fixed-mindset", "body": "Thêm một chữ vào câu tự nói: tôi chưa làm được. Nỗ lực không phải bằng chứng của kém cỏi, nó là cách duy nhất năng lực tăng lên; và một bài trượt là dữ liệu về cách học hiện tại, không phải phán quyết về trí tuệ của bạn.", "priority": 10},
    {"misconception": "knm.compare-upward", "body": "Đổi mốc so sánh về chính bạn của ba tháng trước: làm được gì bây giờ mà lúc đó chưa làm được. Thước đo đó ổn định, kiểm được, và nói thẳng ra bước tiếp theo — thứ mà bảng xếp hạng với người khác không bao giờ nói.", "priority": 10},
    {"misconception": "knm.self-compassion-is-weak", "body": "Thử phép kiểm này: nếu bạn thân gặp đúng chuyện của bạn, bạn sẽ nói gì với họ? Câu đó thường vừa tử tế vừa thẳng thắn. Tự trắc ẩn là nói câu ấy với chính mình — nó khác với bào chữa, vì nó vẫn gọi đúng tên phần mình làm chưa được.", "priority": 10},
    {"misconception": "knm.mental-health-willpower", "body": "Có một ranh giới cần biết: khi mất ngủ, mất hứng thú, mệt mỏi kéo dài trên hai tuần và ảnh hưởng tới việc học việc làm, đó không còn là chuyện luyện tư duy. Hãy tìm phòng tham vấn tâm lý của trường hoặc bác sĩ chuyên khoa — cũng bình thường như đi khám khi gãy tay.", "priority": 20},
    # ── Module 3 ────────────────────────────────────────────────────────────
    {"misconception": "knm.critical-is-negative", "body": "Phản biện không phải tìm lỗi người khác mà là kiểm chất lượng của một lập luận, kể cả của mình. Phép thử: sau khi phản biện, bạn có nói được kết luận nào đáng tin hơn không? Nếu chỉ còn lại sự nghi ngờ thì việc chưa xong.", "priority": 10},
    {"misconception": "knm.opinion-as-evidence", "body": "Hãy tách ba mảnh: khẳng định là gì, bằng chứng nào đỡ nó, và suy luận nào nối hai thứ đó. Cảm giác chắc chắn không nằm ở mảnh nào trong ba mảnh ấy.", "priority": 10},
    {"misconception": "knm.confirmation-bias", "body": "Trước khi tra cứu, hãy viết ra điều gì sẽ khiến bạn đổi ý. Rồi chủ động tìm đúng thứ đó. Đọc thêm mười nguồn cùng chiều chỉ làm bạn chắc chắn hơn, không làm bạn đúng hơn.", "priority": 10},
    {"misconception": "knm.correlation-causation", "body": "Hai thứ đi cùng nhau còn ba cách giải thích khác trước khi tới nhân quả: chiều ngược lại, một yếu tố thứ ba, hoặc trùng hợp. Hãy nêu tên yếu tố thứ ba khả dĩ trước khi kết luận.", "priority": 10},
    {"misconception": "knm.authority-or-crowd", "body": "Uy tín người nói là lý do để nghe kỹ, không phải lý do để tin; lượt chia sẻ đo độ lan truyền, không đo độ đúng. Câu hỏi giữ nguyên: bằng chứng ở đâu, ai kiểm được nó.", "priority": 10},
    {"misconception": "knm.anecdote-as-proof", "body": "Một trường hợp cho bạn giả thuyết, không cho bạn tỉ lệ. Hãy hỏi: điều này đúng với bao nhiêu người, trong điều kiện nào, và có ai đã đo chưa.", "priority": 10},
    {"misconception": "knm.straw-man", "body": "Trước khi phản bác, hãy diễn đạt lại ý đối phương bằng lời của bạn và hỏi họ: mình hiểu đúng chưa? Nếu họ gật đầu thì bạn mới đang tranh luận với bản gốc.", "priority": 10},
    {"misconception": "knm.false-dilemma", "body": "Hỏi thêm một câu: còn phương án thứ ba nào không, và có cách nào lấy phần tốt của cả hai không? Phần lớn tình huống bị đóng khung thành hai lựa chọn là do người trình bày, không phải do bản chất vấn đề.", "priority": 10},
    {"misconception": "knm.vertical-reading", "body": "Đừng đánh giá một trang bằng chính trang đó. Mở tab mới, tìm tên nguồn ấy kèm từ khoá đánh giá hoặc kiểm chứng, xem nơi khác nói gì — rồi mới quay lại đọc nội dung.", "priority": 10},
    {"misconception": "knm.ai-fluency-truth", "body": "Câu trả lời của AI trôi chảy vì mô hình tối ưu cho sự hợp lý bề mặt, không phải cho tính đúng. Mọi con số, tên riêng và trích dẫn đều phải kiểm lại ở nguồn gốc trước khi dùng.", "priority": 10},
    # ── Module 4 ────────────────────────────────────────────────────────────
    {"misconception": "knm.busy-equals-productive", "body": "Hãy đổi thước đo: cuối ngày hỏi mình đã nhích được mục tiêu nào, thay vì đã làm bao nhiêu việc. Một ngày bận kín mà không mục tiêu nào tiến lên là một ngày làm việc của người khác.", "priority": 10},
    {"misconception": "knm.urgent-equals-important", "body": "Khẩn cấp nói về thời hạn, quan trọng nói về đóng góp cho mục tiêu của bạn. Trước khi làm việc đang réo, hỏi một câu: việc này quan trọng với ai? Nhiều việc khẩn cấp là việc quan trọng của người khác.", "priority": 10},
    {"misconception": "knm.no-time-to-plan", "body": "Lập kế hoạch chính là việc quan trọng mà không khẩn cấp, nên nó luôn bị đẩy lùi. Hãy cấp cho nó một khung giờ cố định — mười lăm phút mỗi sáng thứ hai — chứ đừng đợi lúc rảnh, vì lúc ấy không tới.", "priority": 10},
    {"misconception": "knm.multitask-efficient", "body": "Não không chạy song song mà chuyển qua lại, mỗi lần chuyển tốn chi phí khởi động. Hãy thử đo: làm hai việc xen kẽ rồi làm lần lượt từng việc, so tổng thời gian và số lỗi.", "priority": 10},
    {"misconception": "knm.goal-vague", "body": "Một mục tiêu dùng được phải trả lời được: đo bằng con số nào, xong trước ngày nào, và hôm nay làm gì để tiến tới. Học giỏi hơn không trả lời được câu nào trong ba câu đó.", "priority": 10},
    {"misconception": "knm.more-goals-better", "body": "Quỹ thời gian cố định, nên tám mục tiêu nghĩa là mỗi mục tiêu được một phần tám sự chú ý. Hãy giữ tối đa ba mục tiêu cho một học kỳ và ghi rõ những mục tiêu còn lại đang được hoãn có ý thức.", "priority": 10},
    {"misconception": "knm.saying-no-rude", "body": "Nói không đúng cách gồm ba phần: ghi nhận đề nghị, nêu lý do thật ngắn gọn gắn với cam kết đang có, và đề xuất phương án khác nếu có. Nhận bừa rồi làm hỏng mới là thứ làm mất lòng tin.", "priority": 10},
    {"misconception": "knm.procrastination-lazy", "body": "Hỏi trước khi trách: nhiệm vụ này đang gây cảm giác gì — mơ hồ, sợ làm dở, hay chán? Rồi làm rõ bước đầu tiên nhỏ tới mức làm được trong hai phút. Trì hoãn giảm khi cảm giác khó chịu giảm, không giảm khi ta tự mắng.", "priority": 10},
    {"misconception": "knm.always-available", "body": "Thoả thuận trước thời gian phản hồi — ví dụ trong vòng bốn giờ giờ hành chính — rồi tắt thông báo giữa các khung đó. Chuyên nghiệp là giữ đúng cam kết phản hồi, không phải trả lời tức thì rồi hỏng việc đang làm.", "priority": 10},
    # ── Module 5 ────────────────────────────────────────────────────────────
    {"misconception": "knm.sent-equals-received", "body": "Thông điệp chỉ tồn tại ở dạng người kia hiểu. Trước khi coi việc đã xong, hãy lấy một tín hiệu phản hồi: nhờ họ tóm tắt lại bằng lời của họ, hoặc hỏi một câu mở về bước tiếp theo.", "priority": 10},
    {"misconception": "knm.mehrabian-93", "body": "Tỉ lệ 7–38–55 chỉ áp dụng cho việc truyền đạt thái độ và cảm xúc khi lời nói mâu thuẫn với giọng điệu và nét mặt. Với một hướng dẫn kỹ thuật hay một bản báo cáo, nội dung vẫn là phần chính.", "priority": 10},
    {"misconception": "knm.channel-default", "body": "Chọn kênh theo nội dung: việc phức tạp hoặc nhạy cảm thì gặp trực tiếp hoặc gọi; việc cần lưu vết và không gấp thì viết. Nhắn tin hợp cho câu hỏi ngắn, không hợp cho tin xấu và tranh luận.", "priority": 10},
    {"misconception": "knm.jargon-professional", "body": "Viết cho người đọc, không viết cho mình. Nếu người nhận ngoài ngành, hãy đổi mỗi thuật ngữ thành một câu đời thường — và nếu buộc phải dùng, giải thích ngay lần đầu xuất hiện.", "priority": 10},
    {"misconception": "knm.single-cue-decoding", "body": "Một cử chỉ đơn lẻ không nói được gì: người khoanh tay có thể chỉ đang lạnh. Hãy đọc theo cụm ba dấu hiệu trở lên, đặt trong bối cảnh, rồi kiểm bằng một câu hỏi thay vì kết luận trong đầu.", "priority": 10},
    {"misconception": "knm.silence-means-understood", "body": "Đừng hỏi mọi người rõ chưa — gần như luôn nhận được cái gật đầu. Hãy hỏi ai đó tóm tắt lại việc mình sẽ làm và hạn nộp, hoặc hỏi một câu mở về chỗ nào dễ vướng nhất.", "priority": 10},
    {"misconception": "knm.assertive-is-aggressive", "body": "Quyết đoán có hai vế cùng lúc: nói rõ nhu cầu và giới hạn của mình, đồng thời ghi nhận nhu cầu của người kia. Thiếu vế đầu là phục tùng, thiếu vế sau là hung hăng.", "priority": 10},
    {"misconception": "knm.bad-news-vague", "body": "Nói tin xấu sớm, rõ và ngắn, rồi mới nói tới bối cảnh và phương án. Người nghe cần biết chuyện gì xảy ra, nó ảnh hưởng tới họ ra sao, và bước tiếp theo là gì — vòng vo chỉ kéo dài phần khó chịu.", "priority": 10},
    {"misconception": "knm.reply-in-anger", "body": "Tách dữ kiện khỏi giọng điệu. Ghi nhận sự việc, xin lỗi đúng phần mình sai, nêu việc sẽ làm và mốc thời gian. Đừng trả lời phần cảm xúc bằng cảm xúc — và nếu đang nóng, hãy soạn nháp rồi gửi sau ba mươi phút.", "priority": 10},
    {"misconception": "knm.culture-universal", "body": "Khoảng cách đứng, mức độ nhìn thẳng, cách nói thẳng hay nói vòng đều thay đổi theo văn hoá, vùng miền và cả thế hệ. Khi làm việc với người từ bối cảnh khác, hãy quan sát và hỏi thay vì suy từ thói quen của mình.", "priority": 10},
    # ── Module 6 ────────────────────────────────────────────────────────────
    {"misconception": "knm.hearing-is-listening", "body": "Nghe là chuyện của tai, lắng nghe là chuyện của sự chú ý có chủ đích. Phép thử: sau cuộc trò chuyện, bạn tóm tắt lại được ý chính và cảm xúc của người kia không? Không thì bạn mới nghe thấy.", "priority": 10},
    {"misconception": "knm.listen-to-reply", "body": "Nếu bạn đang soạn câu đáp trong đầu thì bạn đã ngừng nghe. Hãy đặt một quy tắc: chỉ được nghĩ tới câu trả lời sau khi đã tóm tắt được ý người kia bằng một câu.", "priority": 10},
    {"misconception": "knm.selective-listening", "body": "Hãy hỏi mình phần nào trong câu chuyện vừa rồi bạn thấy khó nghe hoặc không hợp ý. Đó chính là phần bạn dễ bỏ qua nhất — và thường là phần chứa thông tin mới.", "priority": 10},
    {"misconception": "knm.advice-too-early", "body": "Trước khi khuyên, hãy hỏi một câu: bạn muốn mình nghe thôi hay muốn mình góp ý? Câu hỏi này mất ba giây và loại bỏ phần lớn những lời khuyên trượt.", "priority": 10},
    {"misconception": "knm.interrupt-to-help", "body": "Mỗi lần ngắt lời là một lần người nói phải dựng lại mạch. Nếu sợ quên ý của mình, hãy ghi một từ ra giấy rồi để họ nói hết — ý của bạn không mất, còn phần họ chưa kịp nói thì mất thật.", "priority": 10},
    {"misconception": "knm.silence-is-awkward", "body": "Đếm thầm tới ba trước khi nói tiếp. Khoảng dừng ấy thường là lúc người kia đang chạm tới điều khó nói nhất, và họ chỉ nói ra nếu bạn để trống chỗ cho nó.", "priority": 10},
    {"misconception": "knm.empathy-is-agreement", "body": "Gọi tên cảm xúc của người kia không phải là đồng ý với kết luận của họ. Có vẻ bạn đang thất vọng vì việc này là một câu mô tả, không phải một lời thừa nhận đúng sai.", "priority": 10},
    {"misconception": "knm.closed-questions", "body": "Đổi câu hỏi đóng thành câu mở: thay vì em ổn chứ, hãy hỏi phần nào khiến em thấy khó nhất. Câu mở bắt đầu bằng thế nào, điều gì, kể thêm — và nó mở ra đúng phần bạn cần biết.", "priority": 10},
    # ── Module 7 ────────────────────────────────────────────────────────────
    {"misconception": "knm.slide-is-document", "body": "Slide là chỗ dựa thị giác, không phải bản in để đọc. Hãy giữ mỗi slide một ý, ít dòng chữ, và chuyển toàn bộ chi tiết sang tài liệu phát riêng.", "priority": 10},
    {"misconception": "knm.info-not-message", "body": "Viết ra một câu duy nhất bạn muốn khán giả nhớ sau khi rời phòng, rồi kiểm mọi slide theo câu đó. Slide nào không phục vụ nó là slide nên bỏ.", "priority": 10},
    {"misconception": "knm.audience-is-me", "body": "Trước khi soạn, trả lời ba câu: họ đã biết gì, họ cần gì ở bài này, và họ sẽ dùng nó để làm gì. Cùng một đề tài phải được kể khác đi cho hai nhóm khán giả khác nhau.", "priority": 10},
    {"misconception": "knm.no-need-rehearse", "body": "Hãy tập nói to ít nhất một lần có bấm giờ. Chỉ khi nói thành tiếng bạn mới phát hiện chỗ ý nhảy, chỗ hụt hơi và phần vượt thời lượng — đọc thầm không lộ ra ba lỗi đó.", "priority": 10},
    {"misconception": "knm.qa-must-know-all", "body": "Không biết thì nói không biết, kèm cam kết cụ thể: phần đó tôi chưa có số liệu, tôi kiểm lại và gửi anh chị trong hôm nay. Chế câu trả lời là cách nhanh nhất để mất uy tín với đúng người hiểu chuyện.", "priority": 10},
    {"misconception": "knm.rush-when-over-time", "body": "Quá giờ thì bỏ bớt phần giữa, đừng bóp phần kết. Khán giả không biết bạn đã bỏ slide nào, nhưng họ nhận ra ngay một bài kết thúc vội và không đọng lại gì.", "priority": 10},
    {"misconception": "knm.planning-fallacy", "body": "Đừng ước lượng bằng cảm giác — lấy dữ liệu lần trước làm mốc. Lần trước việc này mất bao lâu thì lần này đặt bấy nhiêu, và chỉ rút ngắn khi bạn chỉ ra được cụ thể cách làm nào đã đổi.", "priority": 10},
    {"misconception": "knm.schedule-no-buffer", "body": "Chừa đệm 15 phút giữa các khối và một giờ trống mỗi ngày cho việc phát sinh. Lịch không có đệm là lịch vỡ ngay ở sự cố đầu tiên, và khi đã vỡ thì người ta bỏ luôn cả lịch.", "priority": 10},
    {"misconception": "knm.two-calendars", "body": "Gộp mọi cam kết vào một cuốn lịch duy nhất, cả việc học lẫn việc riêng. Chỉ khi nhìn thấy 18h phải đón em, bạn mới biết là không nên nhận buổi họp lúc 17h30.", "priority": 10},
    {"misconception": "knm.persuasion-is-manipulation", "body": "Ba câu hỏi tách hai thứ này: thông tin bạn đưa có đúng không, người kia có còn tự do từ chối không, và nếu họ đồng ý thì họ được lợi hay chỉ mình bạn được lợi? Trả lời được cả ba theo hướng tích cực thì đó là thuyết phục.", "priority": 10},
    {"misconception": "knm.persuade-by-arguing-harder", "body": "Trước khi thêm lý lẽ, hãy hỏi vì sao họ chưa đồng ý: thiếu thông tin, sợ mất gì, hay không tin người nói? Ba nguyên nhân ấy cần ba cách xử lý khác nhau, và chỉ nguyên nhân đầu mới cần thêm lập luận.", "priority": 10},
    {"misconception": "knm.features-not-benefits", "body": "Sau mỗi tính năng, viết thêm một câu bắt đầu bằng nghĩa là bạn sẽ… — nếu không viết nổi, tính năng đó không nên nằm trong bài thuyết phục.", "priority": 10},
    {"misconception": "knm.reciprocity-small-gift", "body": "Món quà nhỏ vẫn tạo cảm giác mắc nợ, kể cả khi bạn không xin. Cách phòng vệ không phải là từ chối mọi thiện chí, mà là tách hai câu hỏi: món quà này dễ chịu thật, còn đề nghị đi kèm có đáng nhận không?", "priority": 10},
    {"misconception": "knm.consistency-trap", "body": "Hãy hỏi: nếu hôm nay mới biết những gì mình biết bây giờ, mình có chọn như vậy không? Nếu không, đổi ý là quyết định đúng — và bạn chỉ cần nói rõ vì sao đổi.", "priority": 10},
    {"misconception": "knm.authority-symbols", "body": "Tách dấu hiệu khỏi chuyên môn bằng hai câu hỏi: người này có chuyên môn đúng lĩnh vực đang bàn không, và họ được lợi gì nếu bạn tin? Chức danh trả lời được câu đầu một phần, không trả lời được câu sau.", "priority": 10},
    {"misconception": "knm.scarcity-always-real", "body": "Kiểm tính thật của khan hiếm: quay lại sau vài ngày xem ưu đãi có còn không, tìm cùng sản phẩm ở nơi khác, và hỏi mình có định mua thứ này trước khi thấy đồng hồ đếm ngược hay không.", "priority": 10},
    {"misconception": "knm.liking-equals-credible", "body": "Thiện cảm giúp bạn chịu nghe, không thay được bằng chứng. Hãy hỏi đúng câu bạn sẽ hỏi nếu người nói là một người lạ khó ưa: bằng chứng ở đâu, ai kiểm được nó.", "priority": 10},
    {"misconception": "knm.one-size-persuasion", "body": "Trước khi thuyết phục, viết ra ba điều về người nghe: họ đang lo gì, họ mất gì nếu đồng ý, và điều gì với họ là bằng chứng đủ mạnh. Ba câu này quyết định bạn dùng lập luận nào, không phải sở thích của bạn.", "priority": 10},
    {"misconception": "knm.team-is-division", "body": "Chia việc là bước đầu, không phải toàn bộ. Nhóm chỉ hơn tổng các cá nhân khi có ba thứ: mục tiêu chung ai cũng nói được, phần ghép nối được bàn từ sớm, và một lần rà chéo trước khi nộp.", "priority": 10},
    {"misconception": "knm.wait-for-assignment", "body": "Đừng đợi được giao. Hãy hỏi trước một câu: phần nào đang chưa ai nhận, và mình làm được phần nào? Chủ động trong nhóm bắt đầu bằng câu hỏi ấy, không cần chức danh nào cả.", "priority": 10},
    {"misconception": "knm.conflict-is-bad", "body": "Sóng gió là giai đoạn bắt buộc, không phải tai nạn. Việc cần làm không phải dập nó mà là giữ tranh luận ở mức công việc: nói về cách làm và tiêu chí, không nói về con người.", "priority": 10},
    {"misconception": "knm.avoid-conflict", "body": "Né tránh chỉ dời vấn đề tới gần hạn nộp hơn, khi nó đắt hơn nhiều. Hãy nói sớm, nói riêng, và nói bằng sự việc: phần này trễ hai ngày thì phần của mình lùi theo, mình cần biết khi nào có.", "priority": 10},
    {"misconception": "knm.carry-the-team", "body": "Trước khi làm hộ, hãy hỏi vì sao chậm và đề nghị chia nhỏ phần việc đó. Làm hộ cứu được một hạn nộp và tạo ra một nhóm quen ỷ lại — lần sau bạn vẫn là người phải cứu.", "priority": 10},
    {"misconception": "knm.silence-is-agreement", "body": "Đừng đọc im lặng là đồng thuận. Hãy hỏi thẳng người chưa nói: mình muốn nghe ý của bạn về phương án này, hoặc mời từng người nêu một điểm lo ngại trước khi chốt.", "priority": 10},
    {"misconception": "knm.leader-decides-all", "body": "Việc của trưởng nhóm là làm rõ mục tiêu, phân công đúng người, gỡ vướng và giữ nhịp. Nếu bạn đang làm phần lớn khối lượng thì nhóm đang thiếu phân công, chứ không phải bạn đang lãnh đạo tốt.", "priority": 10},
    {"misconception": "knm.role-by-title", "body": "Giao vai trò theo thế mạnh và mức sẵn sàng, và nói rõ kỳ vọng đi kèm từng vai. Người xung phong nhanh nhất không phải lúc nào cũng là người hợp nhất với vai trò đó.", "priority": 10},
    {"misconception": "knm.blame-the-person", "body": "Hỏi trước khi kết luận: có phải phần việc quá lớn, hay yêu cầu chưa rõ, hay bạn ấy đang vướng chuyện riêng? Mỗi nguyên nhân cần một cách gỡ khác nhau, và không nguyên nhân nào được gỡ bằng thái độ.", "priority": 10},
    {"misconception": "knm.cv-one-for-all", "body": "Mỗi vị trí một bản. Không cần viết lại từ đầu: đổi mục tiêu nghề nghiệp, đảo thứ tự các gạch đầu dòng, và dùng lại đúng từ khoá trong mô tả công việc.", "priority": 10},
    {"misconception": "knm.cv-duties-not-results", "body": "Viết theo mẫu: làm gì — bằng cách nào — kết quả đo được. Không có số thì dùng mốc thời gian, quy mô hoặc so sánh trước sau; câu nào không nói được kết quả thì cắt.", "priority": 10},
    {"misconception": "knm.cv-longer-better", "body": "Sinh viên mới ra trường: một trang. Giữ những gì liên quan tới vị trí đang ứng tuyển, phần còn lại để dành cho buổi phỏng vấn hoặc portfolio.", "priority": 10},
    {"misconception": "knm.weakness-fake", "body": "Nêu một điểm yếu thật, không chí mạng với vị trí, kèm việc bạn đang làm để cải thiện và một bằng chứng cho thấy nó đã đỡ hơn. Câu quá cầu toàn bị đọc là né câu hỏi.", "priority": 10},
    {"misconception": "knm.no-questions-asked", "body": "Chuẩn bị sẵn ba câu hỏi về công việc thật: người tiền nhiệm làm gì trong ba tháng đầu, đội nhóm đánh giá công việc này thành công dựa trên gì, và bước tiếp theo của quy trình tuyển là gì.", "priority": 10},
    {"misconception": "knm.interview-improvise", "body": "Câu hỏi phỏng vấn lặp lại tới mức dự đoán được. Hãy chuẩn bị ba tới năm câu chuyện theo cấu trúc bối cảnh – nhiệm vụ – hành động – kết quả, rồi luyện nói to một lần cho mỗi câu chuyện.", "priority": 10},
]

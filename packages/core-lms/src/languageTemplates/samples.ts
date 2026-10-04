/**
 * LANG G8 — nội dung của hai khoá mẫu ngoại ngữ (Tiếng Trung · Tiếng Anh).
 *
 * TOÀN BỘ TỰ SOẠN, trình độ sơ cấp, không trích câu/đoạn/đề của bất kỳ kỳ thi hay giáo trình nào
 * (đề thật có bản quyền). Giờ làm bài và bảng chấm ở đây chỉ là gợi ý cho khung — giảng viên đối
 * chiếu nguồn chính thức rồi chỉnh. Bài Nghe cố ý KHÔNG có audio: audio giả tạo ra thì không có
 * bản quyền rõ ràng, nên giảng viên tự tải audio của mình lên.
 *
 * Dữ liệu thuần (không import Prisma) để test và giao diện dùng chung.
 */

export type TemplateId = "zh" | "en";

/** [nhãn, đúng/sai] — mỗi câu đúng một đáp án đúng. */
export interface SampleQuestion {
  prompt: string;
  options: ReadonlyArray<readonly [string, boolean]>;
  explanation: string;
}

export interface SampleWord {
  term: string;
  reading: string;
  meaning: string;
  example?: string;
  exampleReading?: string;
  exampleMeaning?: string;
}

export interface SampleTurn {
  speaker: string;
  text: string;
  reading?: string;
  translation: string;
}

export interface SampleAssignment {
  title: string;
  description: string;
  rubric: string;
  responseFormat: "text" | "audio";
}

export interface SampleExamSection {
  skill: "listening" | "reading" | "writing";
  minutes: number;
  passage: { title: string; text: string };
  questions: SampleQuestion[];
}

export interface LanguageTemplateDef {
  id: TemplateId;
  label: string;
  hint: string;
  course: { title: string; description: string; language: string };
  /** Nhãn cột phiên âm của khối từ vựng/hội thoại. */
  readingLabel: string;
  moduleTitle: string;
  vocab: { lessonTitle: string; title: string; items: SampleWord[] };
  listening: { lessonTitle: string; noteHtml: string; quiz: { title: string; questions: SampleQuestion[] } };
  speaking: {
    lessonTitle: string;
    html: string;
    dialogue: { title: string; caption: string; turns: SampleTurn[] };
    assignment: SampleAssignment;
  };
  reading: { lessonTitle: string; html: string; quiz: { title: string; questions: SampleQuestion[] } };
  writing: {
    lessonTitle: string;
    html: string;
    quiz: { title: string; questions: SampleQuestion[] };
    assignment: SampleAssignment;
  };
  exam: { title: string; frame: "hsk" | "ielts"; sections: SampleExamSection[] };
}

const q = (
  prompt: string,
  right: string,
  wrong: string[],
  explanation: string,
): SampleQuestion => ({
  prompt,
  options: [[right, true], ...wrong.map((w): readonly [string, boolean] => [w, false])],
  explanation,
});

/** Ghi chú cho giảng viên ở bài Nghe — nhắc tải audio, kèm lời thoại để thu âm. */
const listeningNote = (script: string, lang: string) =>
  `<h2>Bài nghe đang chờ audio của bạn</h2>` +
  `<p><strong>Dành cho giảng viên (xoá khối này sau khi xong):</strong> hãy tải audio của bạn vào bài này ` +
  `(Thêm khối → Âm thanh). Khoá mẫu không kèm audio giả vì chưa có bản quyền rõ ràng.</p>` +
  `<p>Lời thoại gợi ý để thu (${lang}):</p><blockquote>${script}</blockquote>` +
  `<p>Khi có audio, học viên nghe rồi trả lời các câu hỏi bên dưới.</p>`;

// ─── Tiếng Trung ──────────────────────────────────────────────────────────────

const ZH: LanguageTemplateDef = {
  id: "zh",
  label: "Tiếng Trung",
  hint: "Sơ cấp · Pinyin · khung đề kiểu HSK",
  course: {
    title: "Tiếng Trung cơ bản (khoá mẫu)",
    description:
      "<p>Khoá mẫu ngoại ngữ: một bài cho mỗi kỹ năng Nghe · Nói · Đọc · Viết, rubric cho bài Viết/Nói và một đề thi thử kiểu HSK. " +
      "Nội dung tự soạn ở trình độ sơ cấp — hãy sửa cho phù hợp lớp của bạn rồi xuất bản.</p>",
    language: "zh",
  },
  readingLabel: "Pinyin",
  moduleTitle: "Bốn kỹ năng — Giới thiệu bản thân",
  vocab: {
    lessonTitle: "Từ vựng: Giới thiệu bản thân",
    title: "Từ mới",
    items: [
      { term: "我", reading: "wǒ", meaning: "tôi" },
      { term: "你", reading: "nǐ", meaning: "bạn" },
      { term: "叫", reading: "jiào", meaning: "tên là, gọi là", example: "我叫小林。", exampleReading: "Wǒ jiào Xiǎo Lín.", exampleMeaning: "Tôi tên là Tiểu Lâm." },
      { term: "学生", reading: "xuésheng", meaning: "học sinh, sinh viên" },
      { term: "老师", reading: "lǎoshī", meaning: "giáo viên" },
      { term: "喜欢", reading: "xǐhuan", meaning: "thích", example: "我喜欢喝茶。", exampleReading: "Wǒ xǐhuan hē chá.", exampleMeaning: "Tôi thích uống trà." },
      { term: "喝", reading: "hē", meaning: "uống" },
      { term: "茶", reading: "chá", meaning: "trà" },
    ],
  },
  listening: {
    lessonTitle: "Nghe: Hỏi đường",
    noteHtml: listeningNote(
      "A：请问，图书馆在哪儿？ B：在学校的东边，你一直往前走，五分钟就到了。 A：谢谢！ B：不客气。",
      "tiếng Trung",
    ),
    quiz: {
      title: "Nghe hiểu — hỏi đường",
      questions: [
        q("Người A hỏi điều gì?", "Thư viện ở đâu", ["Mấy giờ thư viện mở cửa", "Trường ở đâu", "Sách giá bao nhiêu"], "A hỏi “图书馆在哪儿？”."),
        q("Thư viện nằm ở đâu?", "Phía đông của trường", ["Phía tây của trường", "Ngay cổng trường", "Ở tầng hai"], "B nói “在学校的东边”."),
        q("Đi bộ đến thư viện mất bao lâu?", "5 phút", ["10 phút", "15 phút", "1 giờ"], "B nói “五分钟就到了”."),
      ],
    },
  },
  speaking: {
    lessonTitle: "Nói: Chào hỏi và giới thiệu",
    html:
      "<h2>Luyện nói</h2><p>Nghe hội thoại mẫu, đọc theo từng câu, rồi ghi âm phần giới thiệu của chính bạn ở bài tập bên dưới.</p>",
    dialogue: {
      title: "Hội thoại mẫu: Làm quen",
      caption: "Bật/tắt Pinyin và bản dịch để tự kiểm tra. Đọc to theo từng lượt.",
      turns: [
        { speaker: "A", text: "你好！你叫什么名字？", reading: "Nǐ hǎo! Nǐ jiào shénme míngzi?", translation: "Xin chào! Bạn tên là gì?" },
        { speaker: "B", text: "我叫小林。你呢？", reading: "Wǒ jiào Xiǎo Lín. Nǐ ne?", translation: "Tôi tên là Tiểu Lâm. Còn bạn?" },
        { speaker: "A", text: "我叫大卫。你是学生吗？", reading: "Wǒ jiào Dàwèi. Nǐ shì xuésheng ma?", translation: "Tôi tên là Đại Vệ. Bạn là học sinh à?" },
        { speaker: "B", text: "是，我是学生。你喜欢喝茶吗？", reading: "Shì, wǒ shì xuésheng. Nǐ xǐhuan hē chá ma?", translation: "Vâng, tôi là học sinh. Bạn thích uống trà không?" },
        { speaker: "A", text: "我喜欢喝茶。", reading: "Wǒ xǐhuan hē chá.", translation: "Tôi thích uống trà." },
        { speaker: "B", text: "太好了！我们一起去喝茶吧。", reading: "Tài hǎo le! Wǒmen yìqǐ qù hē chá ba.", translation: "Tuyệt quá! Chúng ta cùng đi uống trà nhé." },
      ],
    },
    assignment: {
      title: "Ghi âm: Giới thiệu bản thân (khoảng 1 phút)",
      description:
        "Ghi âm phần giới thiệu bản thân bằng tiếng Trung: tên, nghề nghiệp/học sinh, một sở thích. " +
        "Lưu ý: chấm tự động bài Nói chưa bật — giảng viên nghe và chấm theo rubric.",
      rubric:
        "Rubric Nói (100 điểm)\n" +
        "1. Nội dung và đủ ý (30): nêu đủ tên, nghề/học sinh, sở thích.\n" +
        "2. Phát âm và thanh điệu (30): thanh điệu đúng, âm dễ nghe.\n" +
        "3. Từ vựng và ngữ pháp (25): dùng đúng mẫu câu đã học.\n" +
        "4. Lưu loát (15): ít ngắt quãng, tốc độ vừa phải.\n" +
        "Ghi chú: chấm phát âm tự động còn nhiều giới hạn — luôn để giảng viên quyết định điểm cuối.",
      responseFormat: "audio",
    },
  },
  reading: {
    lessonTitle: "Đọc: Gia đình của Tiểu Lâm",
    html:
      "<h2>Đọc đoạn văn</h2><p>我叫小林，我是学生。我家有四口人：爸爸、妈妈、哥哥和我。" +
      "我爸爸是老师，我妈妈是医生。我们都喜欢喝茶。</p><p>Đọc kỹ rồi làm bài đọc hiểu bên dưới. (医生 yīshēng: bác sĩ)</p>",
    quiz: {
      title: "Đọc hiểu — gia đình Tiểu Lâm",
      questions: [
        q("Nhà Tiểu Lâm có mấy người?", "4 người", ["3 người", "5 người", "6 người"], "Đoạn văn: “我家有四口人”."),
        q("Mẹ của Tiểu Lâm làm nghề gì?", "Bác sĩ", ["Giáo viên", "Học sinh", "Đầu bếp"], "Đoạn văn: “我妈妈是医生”."),
        q("Cả nhà đều thích gì?", "Uống trà", ["Xem phim", "Chạy bộ", "Nấu ăn"], "Đoạn văn: “我们都喜欢喝茶”."),
      ],
    },
  },
  writing: {
    lessonTitle: "Viết: Giới thiệu bản thân",
    html:
      "<h2>Viết câu giới thiệu</h2><p>Mẫu câu: <strong>我叫…。我是…。我喜欢…。</strong> " +
      "Phủ định đặt <strong>不</strong> trước động từ: 我<strong>不</strong>是老师。</p>",
    quiz: {
      title: "Viết — mẫu câu giới thiệu",
      questions: [
        q("Câu nào đúng ngữ pháp?", "我是学生。", ["我学生是。", "是我学生。", "学生我是。"], "Trật tự: Chủ ngữ + 是 + danh từ."),
        q("Điền vào chỗ trống: 我___喝茶。", "喜欢", ["学生", "老师", "名字"], "喜欢 + động từ: thích làm gì."),
        q("“Tôi không phải giáo viên.” viết thế nào?", "我不是老师。", ["我是不老师。", "我不老师是。", "不我是老师。"], "不 đặt ngay trước 是."),
      ],
    },
    assignment: {
      title: "Viết: Đoạn giới thiệu bản thân (5 câu)",
      description:
        "Viết 5 câu giới thiệu bản thân bằng tiếng Trung (tên, nghề nghiệp/học sinh, gia đình, sở thích). " +
        "Dùng ít nhất 3 từ trong bài từ vựng.",
      rubric:
        "Rubric Viết (100 điểm)\n" +
        "1. Nội dung và đủ ý (30): đủ 5 câu, đúng chủ đề giới thiệu bản thân.\n" +
        "2. Từ vựng (25): dùng đúng từ đã học, chữ Hán viết đúng.\n" +
        "3. Ngữ pháp (30): trật tự câu, dùng 是/不/喜欢 đúng.\n" +
        "4. Trình bày (15): dấu câu đầy đủ, rõ ràng, dễ đọc.",
      responseFormat: "text",
    },
  },
  exam: {
    title: "Thi thử kiểu HSK (mẫu)",
    frame: "hsk",
    sections: [
      {
        skill: "listening",
        minutes: 15,
        passage: {
          title: "Hội thoại (lời thoại thay cho audio — giảng viên thay bằng audio của mình)",
          text: "A：明天你有时间吗？ B：明天下午我要去上课，晚上有时间。 A：那我们晚上去看电影吧。 B：好，七点在电影院门口见。",
        },
        questions: [
          q("Chiều mai B làm gì?", "Đi học", ["Đi làm", "Đi xem phim", "Ở nhà"], "B nói “明天下午我要去上课”."),
          q("Tối mai họ định làm gì?", "Xem phim", ["Ăn cơm", "Đi học", "Đi mua sắm"], "A đề nghị “去看电影”."),
          q("Họ hẹn gặp lúc mấy giờ?", "7 giờ", ["6 giờ", "8 giờ", "9 giờ"], "B nói “七点…见”."),
        ],
      },
      {
        skill: "reading",
        minutes: 20,
        passage: {
          title: "Đoạn văn ngắn",
          text: "今天天气很好，我和朋友去公园玩儿。公园里有很多人，有的在跑步，有的在打球。我们玩儿了两个小时，然后一起去吃饭。",
        },
        questions: [
          q("Người viết cùng bạn đi đâu?", "Công viên", ["Trường học", "Thư viện", "Nhà hàng"], "Đoạn văn: “去公园玩儿”."),
          q("Họ chơi bao lâu?", "2 tiếng", ["1 tiếng", "3 tiếng", "Cả buổi chiều"], "Đoạn văn: “玩儿了两个小时”."),
          q("Chơi xong họ làm gì?", "Cùng đi ăn", ["Về nhà ngủ", "Đi học", "Đi xem phim"], "Đoạn văn: “然后一起去吃饭”."),
        ],
      },
      {
        skill: "writing",
        minutes: 15,
        passage: { title: "Chọn câu đúng", text: "Mỗi câu hỏi có một đáp án đúng ngữ pháp." },
        questions: [
          q("Chọn câu đúng:", "他每天坐公共汽车去学校。", ["他每天去学校坐公共汽车。", "他坐每天公共汽车去学校。"], "Phương tiện đặt trước động từ chính: 坐公共汽车去学校."),
          q("Chọn câu đúng:", "我们一起去看电影吧。", ["我们去一起看电影吧。", "我们看电影去一起吧。"], "一起 đặt trước động từ: 一起去."),
          q("Chọn câu đúng:", "她没有哥哥。", ["她不有哥哥。", "她哥哥没有。"], "Phủ định của 有 là 没有."),
        ],
      },
    ],
  },
};

// ─── Tiếng Anh ────────────────────────────────────────────────────────────────

const EN: LanguageTemplateDef = {
  id: "en",
  label: "Tiếng Anh",
  hint: "Sơ cấp · IPA · khung đề kiểu IELTS",
  course: {
    title: "Tiếng Anh cơ bản (khoá mẫu)",
    description:
      "<p>Khoá mẫu ngoại ngữ: một bài cho mỗi kỹ năng Nghe · Nói · Đọc · Viết, rubric cho bài Viết/Nói và một đề thi thử kiểu IELTS. " +
      "Nội dung tự soạn ở trình độ sơ cấp — hãy sửa cho phù hợp lớp của bạn rồi xuất bản.</p>",
    language: "en",
  },
  readingLabel: "IPA",
  moduleTitle: "Four skills — Everyday life",
  vocab: {
    lessonTitle: "Vocabulary: Study and library",
    title: "New words",
    items: [
      { term: "appointment", reading: "/əˈpɔɪntmənt/", meaning: "cuộc hẹn", example: "I have an appointment at ten.", exampleMeaning: "Tôi có một cuộc hẹn lúc mười giờ." },
      { term: "schedule", reading: "/ˈʃedjuːl/", meaning: "lịch trình, thời khoá biểu" },
      { term: "improve", reading: "/ɪmˈpruːv/", meaning: "cải thiện" },
      { term: "recommend", reading: "/ˌrekəˈmend/", meaning: "giới thiệu, đề xuất", example: "Can you recommend a good book?", exampleMeaning: "Bạn giới thiệu giúp một cuốn sách hay được không?" },
      { term: "available", reading: "/əˈveɪləbl/", meaning: "có sẵn, rảnh" },
      { term: "library", reading: "/ˈlaɪbrəri/", meaning: "thư viện" },
      { term: "deadline", reading: "/ˈdedlaɪn/", meaning: "hạn chót" },
      { term: "borrow", reading: "/ˈbɒrəʊ/", meaning: "mượn" },
    ],
  },
  listening: {
    lessonTitle: "Listening: Booking a class",
    noteHtml: listeningNote(
      "Receptionist: Good morning, City Language Centre. Caller: Hello, I'd like to book an English class. " +
        "Receptionist: We have a class on Tuesday at six thirty in the evening. Caller: That's perfect. My name is Anna Brooks.",
      "tiếng Anh",
    ),
    quiz: {
      title: "Listening — booking a class",
      questions: [
        q("What does the caller want to do?", "Book an English class", ["Cancel a lesson", "Buy a book", "Ask for directions"], "The caller says “I'd like to book an English class”."),
        q("Which day is the class?", "Tuesday", ["Monday", "Thursday", "Saturday"], "The receptionist says “a class on Tuesday”."),
        q("What time does it start?", "6:30 in the evening", ["6:30 in the morning", "7:30 in the evening", "5:30 in the afternoon"], "“six thirty in the evening”."),
      ],
    },
  },
  speaking: {
    lessonTitle: "Speaking: At the library",
    html:
      "<h2>Speaking practice</h2><p>Nghe hội thoại mẫu, đọc theo từng câu, rồi ghi âm phần giới thiệu của chính bạn ở bài tập bên dưới.</p>",
    dialogue: {
      title: "Sample dialogue: Borrowing a book",
      caption: "Bật/tắt bản dịch để tự kiểm tra. Đọc to theo từng lượt.",
      turns: [
        { speaker: "A", text: "Excuse me, could I borrow this book?", translation: "Xin lỗi, tôi mượn cuốn sách này được không?" },
        { speaker: "B", text: "Of course. Do you have a library card?", translation: "Được chứ. Bạn có thẻ thư viện không?" },
        { speaker: "A", text: "Yes, here it is.", translation: "Có, thẻ của tôi đây." },
        { speaker: "B", text: "Thank you. You can keep it for two weeks.", translation: "Cảm ơn bạn. Bạn được giữ sách hai tuần." },
        { speaker: "A", text: "Great. When is the deadline to return it?", translation: "Tuyệt. Hạn trả sách là khi nào?" },
        { speaker: "B", text: "The deadline is the twenty-fifth of June.", translation: "Hạn chót là ngày 25 tháng 6." },
      ],
    },
    assignment: {
      title: "Record: Introduce yourself (about 1 minute)",
      description:
        "Ghi âm phần giới thiệu bản thân bằng tiếng Anh: tên, công việc/học tập, một sở thích và kế hoạch cuối tuần. " +
        "Lưu ý: chấm tự động bài Nói chưa bật — giảng viên nghe và chấm theo rubric.",
      rubric:
        "Rubric Nói (100 điểm)\n" +
        "1. Nội dung và đủ ý (30): nêu đủ tên, việc học/làm, sở thích, kế hoạch.\n" +
        "2. Phát âm và ngữ điệu (30): âm cuối, trọng âm từ, dễ nghe.\n" +
        "3. Từ vựng và ngữ pháp (25): dùng đúng thì và từ đã học.\n" +
        "4. Lưu loát (15): ít ngập ngừng, tốc độ vừa phải.\n" +
        "Ghi chú: chấm phát âm tự động còn nhiều giới hạn — luôn để giảng viên quyết định điểm cuối.",
      responseFormat: "audio",
    },
  },
  reading: {
    lessonTitle: "Reading: Mai in Hanoi",
    html:
      "<h2>Read the text</h2><p>Mai moved to Hanoi last year to study design. She usually gets up at six and cycles to university. " +
      "At weekends she visits the library because it is quiet and has free Wi-Fi. " +
      "Next month she plans to join a photography club to meet new friends.</p><p>Đọc kỹ rồi làm bài đọc hiểu bên dưới.</p>",
    quiz: {
      title: "Reading — Mai in Hanoi",
      questions: [
        q("What does Mai study?", "Design", ["Photography", "Languages", "Medicine"], "“to study design”."),
        q("How does she go to university?", "By bicycle", ["By bus", "On foot", "By motorbike"], "“cycles to university”."),
        q("Why does she like the library?", "It is quiet and has free Wi-Fi", ["It is close to her home", "It sells coffee", "It is open at night"], "“because it is quiet and has free Wi-Fi”."),
      ],
    },
  },
  writing: {
    lessonTitle: "Writing: A short email",
    html:
      "<h2>Writing a short email</h2><p>Cấu trúc gợi ý: lời chào → lý do viết → hai hoặc ba ý chính → lời kết. " +
      "Ví dụ mở đầu: <em>Hi Linh, I'm writing to tell you about my plans for the weekend.</em></p>",
    quiz: {
      title: "Writing — correct sentences",
      questions: [
        q("Which sentence is correct?", "She doesn't like coffee.", ["She don't like coffee.", "She not like coffee.", "She doesn't likes coffee."], "Ngôi thứ ba số ít dùng doesn't + động từ nguyên mẫu."),
        q("Choose the correct word: I am interested ___ music.", "in", ["on", "at", "for"], "be interested in + danh từ."),
        q("Which sentence is correct?", "We usually go to the library on Saturdays.", ["We go usually to the library on Saturdays.", "We usually go at the library on Saturdays.", "We usually going to the library on Saturdays."], "Trạng từ tần suất đứng trước động từ thường."),
      ],
    },
    assignment: {
      title: "Write: An email to a friend (80–100 words)",
      description:
        "Viết một email ngắn (80–100 từ) cho bạn: kể kế hoạch cuối tuần của bạn, nơi bạn định đến và lý do. " +
        "Dùng ít nhất 3 từ trong bài từ vựng.",
      rubric:
        "Rubric Viết (100 điểm)\n" +
        "1. Nội dung và đủ ý (30): trả lời đủ kế hoạch, nơi chốn, lý do; đúng độ dài.\n" +
        "2. Bố cục và liên kết (20): có lời chào/kết, ý nối với nhau bằng từ nối.\n" +
        "3. Từ vựng (25): dùng đúng từ đã học, ít lặp từ.\n" +
        "4. Ngữ pháp (25): thì động từ, hoà hợp chủ ngữ – động từ, giới từ.",
      responseFormat: "text",
    },
  },
  exam: {
    title: "Thi thử kiểu IELTS (mẫu)",
    frame: "ielts",
    sections: [
      {
        skill: "listening",
        minutes: 20,
        passage: {
          title: "Conversation (lời thoại thay cho audio — giảng viên thay bằng audio của mình)",
          text:
            "Man: Hi, I'm calling about the room you advertised. Woman: Yes, it's still available. It's one hundred and fifty pounds a week. " +
            "Man: Does that include internet? Woman: Yes, all bills are included. You can visit it on Friday afternoon.",
        },
        questions: [
          q("What is the man calling about?", "A room to rent", ["A job vacancy", "A language course", "A lost bag"], "He asks about “the room you advertised”."),
          q("How much is the room per week?", "£150", ["£105", "£115", "£500"], "“one hundred and fifty pounds a week”."),
          q("When can he visit the room?", "Friday afternoon", ["Friday morning", "Thursday evening", "Saturday afternoon"], "“on Friday afternoon”."),
        ],
      },
      {
        skill: "reading",
        minutes: 25,
        passage: {
          title: "Bike sharing",
          text:
            "Many cities now offer bicycles for public use. Users pay a small fee and can leave the bike at any station. " +
            "Supporters say the system reduces traffic and pollution. However, some residents complain that the stations take up parking space.",
        },
        questions: [
          q("What is the text mainly about?", "Public bike-sharing systems", ["How to repair a bicycle", "Car parking rules", "A new sports club"], "The whole passage describes bike sharing."),
          q("How do users pay?", "A small fee", ["A yearly tax", "They don't pay", "Only by cash at stations"], "“Users pay a small fee”."),
          q("What do some residents complain about?", "Stations take up parking space", ["The bikes are too expensive", "There is more pollution", "The bikes are noisy"], "“the stations take up parking space”."),
        ],
      },
      {
        skill: "writing",
        minutes: 20,
        passage: { title: "Choose the correct sentence", text: "Each question has one grammatically correct answer." },
        questions: [
          q("Choose the correct sentence:", "If it rains tomorrow, we will stay at home.", ["If it will rain tomorrow, we will stay at home.", "If it rained tomorrow, we will stay at home."], "Câu điều kiện loại 1: if + hiện tại đơn, will + động từ."),
          q("Choose the correct sentence:", "She has lived here since 2019.", ["She lives here since 2019.", "She is living here since 2019."], "since + mốc thời gian dùng với hiện tại hoàn thành."),
          q("Choose the correct sentence:", "There aren't any tickets left.", ["There isn't any tickets left.", "There aren't no tickets left."], "tickets là danh từ số nhiều ⇒ aren't any."),
        ],
      },
    ],
  },
};

export const LANGUAGE_TEMPLATE_DEFS: Readonly<Record<TemplateId, LanguageTemplateDef>> = { zh: ZH, en: EN };

// Mẫu kịch bản dựng sẵn theo khung sư phạm đã kiểm chứng — chỉ gồm
// toolType + label gợi ý, KHÔNG kèm nội dung (câu hỏi/đáp án để trống,
// giáo viên điền khi sửa từng event). Hard-code ở đây thay vì DB để giữ
// tối giản — không có CRUD template.
export type PlanTemplateItem = {
  toolType:
    | "random_picker"
    | "quick_poll"
    | "word_cloud"
    | "grouping_tool"
    | "countdown_timer"
    | "whiteboard";
  label: string;
  config?: Record<string, unknown>;
};

// "both": không phụ thuộc hình thức dạy (mọi tool ở đây đều có QR/link nên
// vốn đã dùng được từ xa). Chỉ tag riêng in_person/online khi việc CHỌN
// TOOL thực sự khác nhau giữa 2 hình thức (vd ghép cặp: tại lớp thì ngồi
// cạnh nhau — không cần Chia nhóm; online thì bắt buộc cần Chia nhóm để
// xếp breakout).
export type DeliveryMode = "in_person" | "online" | "both";

export type PlanTemplate = {
  key: string;
  name: string;
  category: "full" | "warmup";
  mode: DeliveryMode;
  source: string;
  items: PlanTemplateItem[];
};

export const PLAN_TEMPLATES: PlanTemplate[] = [
  {
    key: "think-pair-share",
    name: "Think – Pair – Share (Tại lớp)",
    category: "full",
    mode: "in_person",
    source: "Lyman (1981), cooperative learning",
    items: [
      {
        toolType: "countdown_timer",
        label: "Suy nghĩ độc lập",
        config: { minutes: 2, notes: "Suy nghĩ một mình, chưa trao đổi — viết nhanh ý của em ra giấy hoặc note." },
      },
      // Ghép cặp trên lớp trực tiếp = ngồi cạnh nhau, không cần Chia nhóm.
      {
        toolType: "countdown_timer",
        label: "Thảo luận cặp đôi",
        config: { minutes: 4, notes: "Quay sang bạn ngồi cạnh, chia sẻ và so sánh ý kiến của 2 người." },
      },
      {
        toolType: "random_picker",
        label: "Gọi chia sẻ",
        config: { notes: "Một vài cặp được gọi ngẫu nhiên sẽ chia sẻ lại với cả lớp." },
      },
    ],
  },
  {
    key: "think-pair-share-online",
    name: "Think – Pair – Share (Trực tuyến)",
    category: "full",
    mode: "online",
    source: "Lyman (1981), cooperative learning",
    items: [
      {
        toolType: "countdown_timer",
        label: "Suy nghĩ độc lập",
        config: { minutes: 2, notes: "Suy nghĩ một mình, chưa trao đổi — viết nhanh ý của em ra giấy hoặc note." },
      },
      // Online không ngồi cạnh nhau được — cần Chia nhóm để xếp breakout.
      {
        toolType: "grouping_tool",
        label: "Thảo luận cặp đôi (breakout)",
        config: {
          mode: "groupSize",
          groupSize: 2,
          notes: "Vào phòng breakout với bạn được ghép, chia sẻ và so sánh ý kiến của 2 người.",
        },
      },
      {
        toolType: "random_picker",
        label: "Gọi chia sẻ",
        config: { notes: "Một vài cặp được gọi ngẫu nhiên sẽ chia sẻ lại với cả lớp." },
      },
    ],
  },
  {
    key: "kwl",
    name: "KWL (Know – Want – Learn)",
    category: "full",
    mode: "both",
    source: "Ogle (1986), reading comprehension",
    items: [
      { toolType: "word_cloud", label: "Đã biết gì (K)" },
      { toolType: "whiteboard", label: "Muốn biết gì (W)" },
      { toolType: "word_cloud", label: "Đã học được gì (L)" },
    ],
  },
  {
    key: "exit-ticket",
    name: "Exit Ticket / Formative check",
    category: "full",
    mode: "both",
    source: "Formative assessment, 5E \"Evaluate\"",
    items: [
      { toolType: "grouping_tool", label: "Luyện tập nhóm" },
      { toolType: "countdown_timer", label: "Đếm giờ luyện tập" },
      { toolType: "quick_poll", label: "Kiểm tra nhanh" },
      { toolType: "word_cloud", label: "1 điều nhớ nhất" },
    ],
  },
  {
    key: "retrieval-practice",
    name: "Retrieval Practice (ôn bài cũ)",
    category: "warmup",
    mode: "both",
    source: "Roediger & Karpicke",
    items: [{ toolType: "random_picker", label: "Gọi ngẫu nhiên ôn bài cũ" }],
  },
  {
    key: "activating-prior-knowledge",
    name: "Activating Prior Knowledge",
    category: "warmup",
    mode: "both",
    source: "Tiền đề của KWL / Ausubel",
    items: [{ toolType: "word_cloud", label: "Khi nhắc tới chủ đề, em nghĩ đến từ gì?" }],
  },
  {
    key: "bell-ringer",
    name: "Bell Ringer / Do Now",
    category: "warmup",
    mode: "both",
    source: "Kỹ thuật quản lý lớp phổ biến",
    items: [{ toolType: "quick_poll", label: "Câu hỏi khởi động" }],
  },
  {
    key: "brainstorm",
    name: "Brainstorm mở đầu",
    category: "warmup",
    mode: "both",
    source: "Kỹ thuật brainstorm cổ điển",
    items: [{ toolType: "word_cloud", label: "Liên tưởng tự do" }],
  },
];

export const TOOL_TYPE_LABELS: Record<PlanTemplateItem["toolType"], string> = {
  random_picker: "Random Picker",
  quick_poll: "Quick Poll",
  word_cloud: "Word Cloud",
  grouping_tool: "Chia nhóm",
  countdown_timer: "Đếm ngược",
  whiteboard: "Whiteboard",
};

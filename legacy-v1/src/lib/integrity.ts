// Heuristic phát hiện rủi ro liêm chính học thuật
// KHÔNG đảm bảo chính xác - chỉ dùng để gợi ý cảnh báo cho giảng viên

export interface IntegritySignals {
  word_count: number;
  time_spent_sec: number;
  paste_count: number;
  edit_count: number;
}

export interface IntegrityFlag {
  level: "low" | "medium" | "high";
  reasons: string[];
  // Tỉ lệ "có thể chứa nội dung AI/copy-paste" — chỉ là heuristic, KHÔNG đáng tin tuyệt đối
  ai_likelihood_score: number; // 0-100
}

export function evaluateIntegrity(s: IntegritySignals): IntegrityFlag {
  const reasons: string[] = [];
  let score = 0;

  // 1. Tốc độ viết (từ/phút). Bình thường: 15-40 từ/phút khi viết bài học thuật.
  const minutes = Math.max(0.5, s.time_spent_sec / 60);
  const wpm = s.word_count / minutes;
  if (wpm > 80) {
    reasons.push(`Tốc độ viết rất cao (${Math.round(wpm)} từ/phút) — gợi ý có thể đã copy/paste khối lớn.`);
    score += 35;
  } else if (wpm > 50) {
    reasons.push(`Tốc độ viết hơi nhanh (${Math.round(wpm)} từ/phút).`);
    score += 15;
  }

  // 2. Số lần paste so với word count
  if (s.paste_count >= 3) {
    reasons.push(`Paste ${s.paste_count} lần — kiểm tra nguồn gốc nội dung.`);
    score += 25;
  } else if (s.paste_count >= 1 && s.word_count > 200) {
    reasons.push(`Có ${s.paste_count} lần paste với bài dài - có thể là trích dẫn.`);
    score += 10;
  }

  // 3. Edit count rất thấp so với word count → bài có thể được dán nguyên khối
  if (s.word_count > 150 && s.edit_count < 20) {
    reasons.push(`Chỉ ${s.edit_count} lần chỉnh sửa cho bài ${s.word_count} từ — bất thường.`);
    score += 25;
  }

  // 4. Thời gian quá ngắn so với độ dài bài
  if (s.word_count > 100 && s.time_spent_sec < 60) {
    reasons.push(`Hoàn thành bài ${s.word_count} từ trong dưới 1 phút.`);
    score += 30;
  }

  score = Math.min(100, score);
  let level: "low" | "medium" | "high" = "low";
  if (score >= 50) level = "high";
  else if (score >= 25) level = "medium";

  return { level, reasons, ai_likelihood_score: score };
}

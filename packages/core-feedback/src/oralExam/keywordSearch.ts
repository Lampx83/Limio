// Chọn đoạn tài liệu cho vấn đáp KHÔNG cần embeddings (chat đã chạy trên LLM tự host, không có OpenAI key).
// Hàm thuần, không I/O — test trực tiếp không cần DB/network.
//
// Đây là phương án lùi, không phải bản thay thế vector: so khớp từ khoá không hiểu đồng nghĩa ("đệ quy"
// vs "hàm tự gọi chính nó"). Đủ để AI bám đúng đoạn khi sinh viên nhắc tới thuật ngữ trong tài liệu; khi có
// OpenAI key và tài liệu đã nhúng vector thì đường vector vẫn được ưu tiên.

// Từ đệm phổ biến — không mang nghĩa chủ đề nên không được phép kéo một đoạn bừa lên đầu. Cố ý KHÔNG đưa
// vào các từ như "for"/"while" vì với tài liệu lập trình đó là thuật ngữ thật.
const STOPWORDS = new Set([
  // vi
  "và", "là", "của", "có", "không", "cho", "các", "những", "một", "được", "trong", "với", "này", "để",
  "khi", "thì", "mà", "như", "đã", "sẽ", "em", "thầy", "cô", "ạ", "nhưng", "nên", "cũng", "rất", "vì",
  "do", "bị", "ra", "vào", "lên", "xuống", "nó", "mình", "tôi", "thế", "nào", "gì", "sao", "đó", "đây",
  // en
  "the", "an", "of", "to", "is", "are", "and", "in", "it", "that", "this", "with", "as", "be", "or",
  "at", "by", "on",
]);

// Đoạn chỉ khớp lẻ tẻ một từ chung ("tự" trong "thứ tự") thì không đáng đưa cho AI cùng đoạn khớp thật:
// bỏ đoạn có điểm dưới tỉ lệ này so với đoạn đứng đầu. Có ngưỡng tương đối chứ không tuyệt đối vì thang
// điểm phụ thuộc độ dài câu hỏi và số đoạn.
const MIN_RELATIVE_SCORE = 0.3;

const HAN = /\p{Script=Han}/u;
const WORD = /[\p{L}\p{M}\p{N}]+/gu;

/**
 * Chữ Hán không có dấu cách giữa các từ nên không tách theo khoảng trắng được: mỗi cụm chữ Hán liền nhau
 * sinh các cặp chữ liền kề (bigram). Cụm chỉ có 1 chữ thì giữ nguyên chữ đó.
 */
function hanTokens(run: string): string[] {
  const chars = Array.from(run);
  if (chars.length === 1) return chars;
  const out: string[] = [];
  for (let i = 0; i < chars.length - 1; i++) out.push(chars[i]! + chars[i + 1]!);
  return out;
}

function tokenize(text: string): string[] {
  const out: string[] = [];
  for (const m of text.normalize("NFC").toLowerCase().matchAll(WORD)) {
    const word = m[0];
    if (HAN.test(word)) {
      // Cụm lẫn Hán + chữ khác (hiếm): tách theo từng đoạn cùng loại.
      for (const part of word.match(/\p{Script=Han}+|[^\p{Script=Han}]+/gu) ?? []) {
        if (HAN.test(part)) out.push(...hanTokens(part));
        else if (part.length >= 2 && !STOPWORDS.has(part)) out.push(part);
      }
      continue;
    }
    if (word.length >= 2 && !STOPWORDS.has(word)) out.push(word);
  }
  return out;
}

/**
 * Xếp hạng đoạn theo mức trùng từ khoá với `query` (tf · idf, idf tính trong phạm vi các đoạn truyền vào).
 * Chỉ trả đoạn có điểm > 0 và không quá thấp so với đoạn đứng đầu (MIN_RELATIVE_SCORE) — không trùng từ
 * nào thì trả rỗng để caller tự quyết lùi tiếp.
 */
export function rankChunksByKeyword<T extends { chunkText: string }>(
  query: string,
  chunks: T[],
  k: number,
): Array<T & { score: number }> {
  if (k <= 0 || chunks.length === 0) return [];
  const queryTerms = new Set(tokenize(query));
  if (queryTerms.size === 0) return [];

  const docs = chunks.map((c) => {
    const tf = new Map<string, number>();
    for (const t of tokenize(c.chunkText)) tf.set(t, (tf.get(t) ?? 0) + 1);
    return tf;
  });

  const n = chunks.length;
  const idf = new Map<string, number>();
  for (const term of queryTerms) {
    const df = docs.reduce((acc, tf) => acc + (tf.has(term) ? 1 : 0), 0);
    if (df > 0) idf.set(term, Math.log(1 + n / df));
  }

  const ranked = chunks
    .map((chunk, i) => {
      let score = 0;
      for (const [term, w] of idf) {
        const f = docs[i]!.get(term) ?? 0;
        // log(1+f): nhắc thuật ngữ 10 lần không nặng gấp 10 lần nhắc 1 lần.
        if (f > 0) score += w * Math.log(1 + f);
      }
      return { ...chunk, score, index: i };
    })
    .filter((r) => r.score > 0)
    // Cùng điểm thì giữ thứ tự trong tài liệu để kết quả ổn định giữa các lần chạy.
    .sort((a, b) => b.score - a.score || a.index - b.index);

  const floor = (ranked[0]?.score ?? 0) * MIN_RELATIVE_SCORE;
  return ranked
    .filter((r) => r.score >= floor)
    .slice(0, k)
    .map(({ index: _index, ...rest }) => rest as unknown as T & { score: number });
}

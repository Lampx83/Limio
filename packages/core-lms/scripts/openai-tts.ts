/**
 * OpenAI TTS (`gpt-4o-mini-tts`) cho học liệu tiếng Trung: khác NEU ở chỗ DẶN ĐƯỢC cách đọc (chậm, rõ, đủ thanh điệu, trọn âm cuối), nên
 * đọc từ đơn không bị vội hay cụt âm cuối. Khoá lấy từ Quản trị › Tích hợp (`openai`).
 * Chỉ gửi chữ của học liệu (từ vựng, câu ví dụ, lời thoại) — không có dữ liệu người học.
 */
const ENDPOINT = "https://api.openai.com/v1/audio/speech";
const MODEL = "gpt-4o-mini-tts";

/** Dặn cách đọc TỪ VỰNG: chậm, rõ từng âm tiết, đủ thanh điệu, trọn âm cuối; hai lần đọc cách nhau một quãng ngắn. */
export const VOCAB_INSTRUCTIONS =
  "Speak standard Mandarin (Beijing accent) with accurate tones. Read slowly and clearly, one syllable at a time, and fully finish the last syllable, like a teacher pronouncing a new word for foreign learners. Pause briefly between repetitions.";

/** Dặn cách đọc CÂU VÍ DỤ / lượt hội thoại: tự nhiên nhưng rõ ràng, đủ thanh điệu. */
export const SENTENCE_INSTRUCTIONS =
  "Speak standard Mandarin (Beijing accent) with accurate tones, in a natural, friendly conversational pace that is still clear enough for foreign learners. Finish every syllable fully.";

export interface OpenAiSpeechOptions {
  apiKey: string;
  voice: string;
  input: string;
  instructions?: string;
  fetchImpl?: typeof fetch;
}

/** Một đoạn chữ → MP3. Ném lỗi khi OpenAI trả lỗi. */
export async function openAiSpeech({ apiKey, voice, input, instructions, fetchImpl = fetch }: OpenAiSpeechOptions): Promise<Buffer> {
  if (input.length > 4000) throw new Error("Đoạn chữ quá dài cho một lượt đọc (> 4000 ký tự)");
  const res = await fetchImpl(ENDPOINT, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
    body: JSON.stringify({ model: MODEL, voice, input, ...(instructions ? { instructions } : {}), response_format: "mp3" }),
    signal: AbortSignal.timeout(60_000),
  });
  if (!res.ok) throw new Error(`OpenAI TTS trả ${res.status}: ${(await res.text()).slice(0, 120)}`);
  return Buffer.from(await res.arrayBuffer());
}

/** Chữ đọc cho MỘT từ vựng: lặp hai lần, ngắt bằng dấu chấm và khoảng trắng (máy tự nghỉ ngắn). */
export function repeatTwice(text: string): string {
  const t = text.trim();
  return `${t}。 ${t}。`;
}

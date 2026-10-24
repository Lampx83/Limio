import { encodeWav } from "./audio";

/**
 * Bộ đọc GIẢ cho máy dev và kiểm thử: không có khoá NEU TTS thì tạo tiếng bíp có độ dài tỷ lệ với số chữ, đủ để thử toàn
 * bộ luồng (ghép, mốc thời gian, mã hoá, phát, tô sáng mục). Tần số khác nhau theo giọng nên nghe được hai người dẫn khác
 * nhau. Lớp gọi phải chặn bộ đọc này ở môi trường production.
 */
export const FAKE_SAMPLE_RATE = 24_000;
/** Giây âm thanh cho mỗi ký tự chữ — nhanh hơn người đọc thật nhưng vẫn cho mục dài cách xa mục ngắn. */
export const FAKE_SECONDS_PER_CHAR = 0.045;

export function fakeSynthesize(text: string, voice: string): Buffer {
  const seconds = Math.max(0.4, text.length * FAKE_SECONDS_PER_CHAR);
  const n = Math.round(seconds * FAKE_SAMPLE_RATE);
  let h = 0;
  for (const ch of voice) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  const freq = 180 + (h % 7) * 40;
  const samples = new Int16Array(n);
  for (let i = 0; i < n; i++) {
    // Bao lên-xuống chậm để nghe ra "câu" thay vì một tiếng ù đều.
    const env = 0.55 + 0.45 * Math.sin((2 * Math.PI * i) / (FAKE_SAMPLE_RATE * 0.9));
    samples[i] = Math.round(4_500 * env * Math.sin((2 * Math.PI * freq * i) / FAKE_SAMPLE_RATE));
  }
  return encodeWav({ sampleRate: FAKE_SAMPLE_RATE, samples });
}

import { createHash } from "node:crypto";
import { storageFor } from "@/lib/storage";
import { voiceSampleKey } from "@/lib/storage-keys";
import { getSynthesizer } from "./tts";
import { sampleTextFor } from "./voiceCatalog";

/**
 * Bản đọc thử của một giọng: gọi TTS đúng một lần rồi lưu file, các lần nghe sau (và của mọi quản trị viên) đọc lại
 * file đó. Đổi câu mẫu thì hash đổi nên tự tạo lại bản mới.
 */

const inflight = new Map<string, Promise<Buffer>>();

export async function getVoiceSample(voice: string, language: string): Promise<Buffer> {
  const synth = await getSynthesizer();
  const text = sampleTextFor(language);
  const hash = createHash("sha1").update(`${voice}\n${text}`).digest("hex").slice(0, 12);
  // Tên giọng đã được route đối chiếu với danh sách của NEU; vẫn làm sạch vì nó thành một phần đường dẫn file.
  const key = voiceSampleKey(synth.mode, voice.replace(/[^A-Za-z0-9_-]/g, "_"), hash);
  const store = storageFor(key);

  if (await store.exists(key.key)) return store.get(key.key);

  // Hai người bấm cùng lúc chỉ gọi TTS một lần.
  const pending =
    inflight.get(key.key) ??
    (async () => {
      const wav = await synth.synthesize(text, voice);
      await store.put(key.key, wav, "audio/wav");
      return wav;
    })().finally(() => inflight.delete(key.key));
  inflight.set(key.key, pending);
  return pending;
}

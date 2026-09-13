// A6.6 — Vấn đáp bằng giọng nói. Adapter gọi Vbee (TTS + STT), tách hẳn khỏi
// examinerChat.ts: chat/tìm tài liệu/trần chi phí ở A6.3 KHÔNG đổi gì — route
// gọi STT trước khi vào runOralExamTurn, gọi TTS sau khi nó trả lời xong.
//
// Nguồn: https://api-docs.vbee.vn/ (Realtime TTS, Batch/async STT + polling
// get-transcript — STT "sync" của Vbee giới hạn <10s, không đủ cho câu trả
// lời vấn đáp nên bắt buộc dùng async + poll).

const VBEE_TTS_URL = "https://api.vbee.vn/v1/tts";
const VBEE_STT_URL = "https://api.vbee.vn/v1/stt";
const vbeeTranscriptUrl = (id: string) => `https://api.vbee.vn/v1/stt/transcripts/${id}`;

// Giới hạn cứng của Vbee — không phải lựa chọn của mình.
export const TTS_MAX_CHARS = 300;
export const DEFAULT_VOICE_CODE = "hn_female_ngochuyen_full_48k-fhg";

const DEFAULT_STT_POLL_INTERVAL_MS = 2000;
const DEFAULT_STT_MAX_POLLS = 20; // ~40s chờ tối đa trước khi báo lỗi timeout.

export interface VbeeCredentials {
  appId: string;
  token: string;
}

export class VbeeError extends Error {
  constructor(
    public readonly code:
      | "tts_failed"
      | "stt_submit_failed"
      | "stt_poll_failed"
      | "stt_failed"
      | "stt_timeout",
    public readonly details?: unknown,
  ) {
    super(code);
  }
}

/**
 * Cắt văn bản thành từng đoạn ≤ maxChars, ưu tiên cắt theo câu (dấu . ! ? …)
 * trước, không cắt giữa từ. Hàm thuần — test không cần gọi Vbee thật.
 */
export function splitForTts(text: string, maxChars: number = TTS_MAX_CHARS): string[] {
  const trimmed = text.trim();
  if (trimmed.length === 0) return [];
  if (trimmed.length <= maxChars) return [trimmed];

  const sentences = trimmed.split(/(?<=[.!?…])\s+/).filter((s) => s.length > 0);
  const chunks: string[] = [];
  let current = "";

  const flush = () => {
    if (current.length > 0) {
      chunks.push(current);
      current = "";
    }
  };

  for (const sentence of sentences) {
    const pieces = sentence.length > maxChars ? splitLongSentence(sentence, maxChars) : [sentence];
    for (const p of pieces) {
      if (current.length === 0) {
        current = p;
      } else if (current.length + 1 + p.length <= maxChars) {
        current = `${current} ${p}`;
      } else {
        flush();
        current = p;
      }
    }
  }
  flush();
  return chunks;
}

function splitLongSentence(sentence: string, maxChars: number): string[] {
  const parts: string[] = [];
  let rest = sentence;
  while (rest.length > maxChars) {
    let cut = rest.lastIndexOf(" ", maxChars);
    if (cut <= 0) cut = maxChars;
    parts.push(rest.slice(0, cut).trim());
    rest = rest.slice(cut).trim();
  }
  if (rest.length > 0) parts.push(rest);
  return parts;
}

export interface TextToSpeechResult {
  /** 1 buffer/đoạn ≤300 ký tự — client phát nối tiếp theo đúng thứ tự. */
  audioChunks: Buffer[];
  contentType: string;
}

/** Nhận toàn bộ câu trả lời của AI (chữ), trả về audio đã tổng hợp. */
export type TextToSpeechFn = (text: string) => Promise<TextToSpeechResult>;

/** Nhận file ghi âm câu trả lời của SV, trả về bản chữ đã nhận dạng. */
export type SpeechToTextFn = (audio: Buffer, mimeType: string) => Promise<{ transcript: string }>;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/** Adapter thật gọi Vbee TTS (realtime/sync, ~500ms/đoạn). */
export function vbeeTextToSpeech(
  creds: VbeeCredentials,
  voiceCode: string = DEFAULT_VOICE_CODE,
): TextToSpeechFn {
  return async (text: string) => {
    const segments = splitForTts(text);
    const audioChunks: Buffer[] = [];
    for (const segment of segments) {
      const res = await fetch(VBEE_TTS_URL, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${creds.token}`,
          "App-Id": creds.appId,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          text: segment,
          mode: "sync",
          voiceCode,
          outputFormat: "mp3",
        }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => null);
        throw new VbeeError("tts_failed", body ?? { status: res.status });
      }
      audioChunks.push(Buffer.from(await res.arrayBuffer()));
    }
    return { audioChunks, contentType: "audio/mpeg" };
  };
}

/**
 * Adapter thật gọi Vbee STT (batch/async + poll get-transcript). Vbee "sync"
 * giới hạn <10s ghi âm — không đủ cho 1 câu trả lời vấn đáp thật, nên luôn
 * đi đường async dù phải chờ vài giây.
 */
export function vbeeSpeechToText(
  creds: VbeeCredentials,
  opts: { pollIntervalMs?: number; maxPolls?: number } = {},
): SpeechToTextFn {
  const pollIntervalMs = opts.pollIntervalMs ?? DEFAULT_STT_POLL_INTERVAL_MS;
  const maxPolls = opts.maxPolls ?? DEFAULT_STT_MAX_POLLS;

  return async (audio: Buffer, mimeType: string) => {
    const form = new FormData();
    // Buffer thoả BlobPart lúc chạy thật; ép kiểu vì lib.dom.d.ts chỉ chấp
    // nhận ArrayBuffer trong khi Buffer khai báo ArrayBufferLike.
    form.append(
      "audioContent",
      new Blob([audio as unknown as BlobPart], { type: mimeType }),
      "answer.wav",
    );
    form.append("mode", "async");

    const submitRes = await fetch(VBEE_STT_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${creds.token}`,
        "App-Id": creds.appId,
      },
      body: form,
    });
    if (!submitRes.ok) {
      const body = await submitRes.json().catch(() => null);
      throw new VbeeError("stt_submit_failed", body ?? { status: submitRes.status });
    }
    const submitBody = (await submitRes.json()) as {
      transcriptId: string;
      status: string;
      transcript?: string;
    };
    if (submitBody.status === "COMPLETED") {
      return { transcript: submitBody.transcript ?? "" };
    }

    for (let i = 0; i < maxPolls; i++) {
      await sleep(pollIntervalMs);
      const pollRes = await fetch(vbeeTranscriptUrl(submitBody.transcriptId), {
        headers: {
          Authorization: `Bearer ${creds.token}`,
          "App-Id": creds.appId,
        },
      });
      if (!pollRes.ok) {
        const body = await pollRes.json().catch(() => null);
        throw new VbeeError("stt_poll_failed", body ?? { status: pollRes.status });
      }
      const pollBody = (await pollRes.json()) as { status: string; transcript?: string };
      if (pollBody.status === "COMPLETED") {
        return { transcript: pollBody.transcript ?? "" };
      }
      if (pollBody.status === "FAILED") {
        throw new VbeeError("stt_failed");
      }
      // PENDING / PROCESSING — vòng tiếp theo.
    }
    throw new VbeeError("stt_timeout");
  };
}
